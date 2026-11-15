import { installRoutingWorker } from '../lib/routing/worker-protocol.js';
import type { WorkerScope } from '../lib/routing/worker-protocol.js';
installRoutingWorker(globalThis as unknown as WorkerScope);
