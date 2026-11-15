import { assertGrid } from './grid.js';
import { planRoute } from './engine.js';
import type { Cell, RouteOptions, RouteResult, RoutingGrid } from './types.js';

export type WorkerRequest = { type: 'init'; grid: RoutingGrid } |
  { type: 'route'; requestId: number; start: Cell; goal: Cell; options: RouteOptions };
export type WorkerResponse = { type: 'ready' } | { type: 'started'; requestId: number } |
  { type: 'result'; requestId: number; result: RouteResult } |
  { type: 'error'; requestId: number | null; message: string };
export interface WorkerScope {
  addEventListener(type: 'message', listener: (event: { data: WorkerRequest }) => void): void;
  postMessage(message: WorkerResponse): void;
}
export function installRoutingWorker(scope: WorkerScope): void {
  let grid: RoutingGrid | null = null;
  scope.addEventListener('message', ({ data }) => {
    try {
      if (data.type === 'init') { assertGrid(data.grid); grid = data.grid; scope.postMessage({ type: 'ready' }); }
      else if (data.type === 'route') {
        if (!grid) throw new Error('Worker dataset not initialized');
        scope.postMessage({ type: 'started', requestId: data.requestId });
        scope.postMessage({ type: 'result', requestId: data.requestId, result: planRoute(grid, data.start, data.goal, data.options) });
      } else throw new Error('Unknown worker message');
    } catch (error) {
      scope.postMessage({ type: 'error', requestId: data.type === 'route' ? data.requestId : null, message: String(error) });
    }
  });
}
