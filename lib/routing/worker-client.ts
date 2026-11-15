import type { Cell, RouteOptions, RouteResult, RoutingGrid } from './types.js';
import type { WorkerRequest, WorkerResponse } from './worker-protocol.js';

export interface WorkerLike {
  onmessage: ((event: { data: WorkerResponse }) => void) | null;
  onerror: ((event: { message: string }) => void) | null;
  postMessage(message: WorkerRequest): void;
  terminate(): void;
}
export type WorkerOutcome = { status: 'completed'; requestId: number; result: RouteResult } |
  { status: 'cancelled'; requestId: number; reason: 'user' | 'superseded' | 'disposed' } |
  { status: 'error'; requestId: number; message: string };
interface Pending { id: number; start: Cell; goal: Cell; options: RouteOptions; resolve: (outcome: WorkerOutcome) => void; sent: boolean }

/** Latest request wins. An active calculation is killed, not merely ignored. */
export class RoutingWorkerClient {
  private worker: WorkerLike | null = null;
  private ready = false;
  private disposed = false;
  private sequence = 0;
  private pending: Pending | null = null;
  constructor(private readonly grid: RoutingGrid, private readonly factory: () => WorkerLike) {}
  isCurrent(requestId: number): boolean { return !this.disposed && requestId === this.sequence; }
  private kill(): void {
    const worker = this.worker;
    this.worker = null; this.ready = false;
    if (worker) { worker.onmessage = null; worker.onerror = null; worker.terminate(); }
  }
  private abort(reason: 'user' | 'superseded' | 'disposed'): void {
    const old = this.pending; this.pending = null;
    this.kill();
    if (old) old.resolve({ status: 'cancelled', requestId: old.id, reason });
  }
  cancel(): void { this.abort('user'); this.sequence++; }
  dispose(): void { this.abort('disposed'); this.disposed = true; this.sequence++; }
  private send(): void {
    const p = this.pending;
    if (this.worker && this.ready && p && !p.sent) {
      p.sent = true;
      this.worker.postMessage({ type: 'route', requestId: p.id, start: p.start, goal: p.goal, options: p.options });
    }
  }
  private spawn(): void {
    const worker = this.factory(); this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (worker !== this.worker) return;
      if (data.type === 'ready') { this.ready = true; this.send(); return; }
      if (data.type === 'started') return;
      const p = this.pending;
      if (!p || (data.requestId !== null && data.requestId !== p.id) || p.id !== this.sequence) return;
      this.pending = null;
      if (data.type === 'result') p.resolve({ status: 'completed', requestId: p.id, result: data.result });
      else { this.kill(); p.resolve({ status: 'error', requestId: p.id, message: data.message }); }
    };
    worker.onerror = ({ message }) => {
      if (worker !== this.worker) return;
      const p = this.pending; this.pending = null; this.kill();
      if (p) p.resolve({ status: 'error', requestId: p.id, message });
    };
    // Structured clone preserves the main-thread arrays for restart. No detaching.
    worker.postMessage({ type: 'init', grid: this.grid });
  }
  request(start: Cell, goal: Cell, options: RouteOptions): Promise<WorkerOutcome> {
    if (this.disposed) return Promise.reject(new Error('Routing client disposed'));
    if (this.pending) this.abort('superseded');
    const id = ++this.sequence;
    return new Promise(resolve => {
      this.pending = { id, start: { ...start }, goal: { ...goal }, options: { ...options }, resolve, sent: false };
      try { if (!this.worker) this.spawn(); this.send(); }
      catch (error) { this.pending = null; this.kill(); resolve({ status: 'error', requestId: id, message: String(error) }); }
    });
  }
}

/** Adapt a native browser Worker without exposing browser objects to the core. */
export function adaptBrowserWorker(worker: Worker): WorkerLike {
  const port: WorkerLike = { onmessage: null, onerror: null,
    postMessage: message => worker.postMessage(message), terminate: () => worker.terminate() };
  worker.addEventListener('message', event => port.onmessage?.({ data: event.data as WorkerResponse }));
  worker.addEventListener('error', event => port.onerror?.({ message: event.message }));
  worker.addEventListener('messageerror', () => port.onerror?.({ message: 'Worker message could not be decoded' }));
  return port;
}
