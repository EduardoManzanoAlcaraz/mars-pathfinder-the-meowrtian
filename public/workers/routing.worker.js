// lib/routing/grid.ts
function assertGrid(grid) {
  const n = grid.width * grid.height;
  if (!Number.isSafeInteger(grid.width) || !Number.isSafeInteger(grid.height) || grid.width < 1 || grid.height < 1 || !Number.isSafeInteger(n) || n >= 2 ** 31) throw new Error("Invalid grid dimensions");
  if (!(grid.elevation instanceof Float32Array) || !(grid.slope instanceof Float32Array) || !(grid.valid instanceof Uint8Array) || grid.elevation.length !== n || grid.slope.length !== n || grid.valid.length !== n) throw new Error("Array types or lengths differ from grid");
  const t = grid.transform;
  if (t.length !== 6 || !t.every(Number.isFinite) || t[1] <= 0 || t[5] >= 0 || t[2] !== 0 || t[4] !== 0 || !Number.isFinite(grid.nodata)) throw new Error("Expected north-up projected metre grid without rotation");
  if (!grid.dataset?.id || !grid.dataset.crsWkt || !grid.dataset.crsProj) throw new Error("Missing data version or Mars CRS");
}
function inBounds(grid, cell) {
  return !!cell && Number.isInteger(cell.col) && Number.isInteger(cell.row) && cell.col >= 0 && cell.row >= 0 && cell.col < grid.width && cell.row < grid.height;
}
function indexOf(grid, cell) {
  return cell.row * grid.width + cell.col;
}
function cellOf(grid, index) {
  return { col: index % grid.width, row: Math.floor(index / grid.width) };
}
function cellBlockReason(grid, index, maxSlopeDeg) {
  const z = grid.elevation[index], s = grid.slope[index];
  if (index < 0 || index >= grid.valid.length || grid.valid[index] !== 1 || !Number.isFinite(z) || !Number.isFinite(s) || z === grid.nodata || s === grid.nodata || s < 0 || s >= 90) return "no-data";
  return s > maxSlopeDeg ? "cell-slope-limit" : null;
}

// lib/routing/heap.ts
var BinaryMinHeap = class {
  nodes = [];
  positions;
  keys;
  ties;
  constructor(capacity) {
    this.positions = new Int32Array(capacity).fill(-1);
    this.keys = new Float64Array(capacity);
    this.ties = new Float64Array(capacity);
  }
  get size() {
    return this.nodes.length;
  }
  less(a, b) {
    return this.keys[a] < this.keys[b] || this.keys[a] === this.keys[b] && (this.ties[a] < this.ties[b] || this.ties[a] === this.ties[b] && a < b);
  }
  swap(a, b) {
    const x = this.nodes[a], y = this.nodes[b];
    this.nodes[a] = y;
    this.nodes[b] = x;
    this.positions[x] = b;
    this.positions[y] = a;
  }
  up(position) {
    let p = position;
    while (p > 0) {
      const parent = p - 1 >>> 1;
      if (!this.less(this.nodes[p], this.nodes[parent])) break;
      this.swap(p, parent);
      p = parent;
    }
    return p;
  }
  down(position) {
    let p = position;
    while (p * 2 + 1 < this.nodes.length) {
      let child = p * 2 + 1;
      if (child + 1 < this.nodes.length && this.less(this.nodes[child + 1], this.nodes[child])) child++;
      if (!this.less(this.nodes[child], this.nodes[p])) break;
      this.swap(p, child);
      p = child;
    }
  }
  set(node, key, tie = 0) {
    if (!Number.isInteger(node) || node < 0 || node >= this.positions.length || !Number.isFinite(key) || !Number.isFinite(tie)) throw new Error("Invalid heap entry");
    this.keys[node] = key;
    this.ties[node] = tie;
    let p = this.positions[node];
    if (p < 0) {
      p = this.nodes.length;
      this.positions[node] = p;
      this.nodes.push(node);
    }
    this.down(this.up(p));
  }
  pop() {
    if (!this.nodes.length) return void 0;
    const root = this.nodes[0], last = this.nodes.pop();
    this.positions[root] = -1;
    if (this.nodes.length) {
      this.nodes[0] = last;
      this.positions[last] = 0;
      this.down(0);
    }
    return root;
  }
};

// lib/routing/engine.ts
var ENGINE_VERSION = "1.0.0";
var DEGREES = 180 / Math.PI;
var NEIGHBOURS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
function normalizeOptions(options) {
  if (!options || !["distance", "slope-penalty"].includes(options.mode)) throw new Error("Unknown routing mode");
  const lambda = options.lambda ?? (options.mode === "distance" ? 0 : 4);
  const maxSlopeDeg = options.maxSlopeDeg ?? 15, thetaRefDeg = options.thetaRefDeg ?? 15;
  const bins = [...options.exposureBinsDeg ?? [0, 5, 10, 15, 90]];
  if (!Number.isFinite(lambda) || lambda < 0 || options.mode === "distance" && lambda !== 0) throw new Error("Distance mode requires lambda=0; penalty lambda must be finite and nonnegative");
  if (!Number.isFinite(maxSlopeDeg) || maxSlopeDeg < 0 || maxSlopeDeg >= 90 || !Number.isFinite(thetaRefDeg) || thetaRefDeg <= 0 || thetaRefDeg >= 90) throw new Error("Invalid slope angles in degrees");
  if (bins.length < 2 || bins[0] !== 0 || bins.at(-1) !== 90 || bins.some((x, i) => !Number.isFinite(x) || i > 0 && x <= bins[i - 1])) throw new Error("Exposure bins must increase strictly from 0 to 90 degrees");
  return { mode: options.mode, lambda, maxSlopeDeg, thetaRefDeg, exposureBinsDeg: bins };
}
function evaluateEdge(grid, from, to, p) {
  if (cellBlockReason(grid, from, p.maxSlopeDeg) || cellBlockReason(grid, to, p.maxSlopeDeg)) return null;
  const a = cellOf(grid, from), b = cellOf(grid, to), dc = b.col - a.col, dr = b.row - a.row;
  if (Math.abs(dc) > 1 || Math.abs(dr) > 1 || dc === 0 && dr === 0) return null;
  if (dc && dr && (cellBlockReason(grid, a.row * grid.width + b.col, p.maxSlopeDeg) || cellBlockReason(grid, b.row * grid.width + a.col, p.maxSlopeDeg))) return null;
  const horizontalMeters = Math.hypot(dc * grid.transform[1], dr * grid.transform[5]);
  const deltaElevationMeters = grid.elevation[to] - grid.elevation[from];
  const segmentSlopeDeg = Math.atan2(Math.abs(deltaElevationMeters), horizontalMeters) * DEGREES;
  const effectiveSlopeDeg = Math.max(segmentSlopeDeg, grid.slope[from], grid.slope[to]);
  if (effectiveSlopeDeg > p.maxSlopeDeg) return null;
  const cost = horizontalMeters * (1 + p.lambda * (effectiveSlopeDeg / p.thetaRefDeg) ** 2);
  return { horizontalMeters, deltaElevationMeters, segmentSlopeDeg, effectiveSlopeDeg, cost };
}
function computeMetrics(grid, cells, p) {
  if (!cells.length) throw new Error("Cannot measure an empty path");
  const exposure = p.exposureBinsDeg.slice(0, -1).map((lowerInclusiveDeg, i) => ({ lowerInclusiveDeg, upperExclusiveDeg: p.exposureBinsDeg[i + 1], horizontalMeters: 0, fractionOfHorizontalLength: 0 }));
  let horizontalMeters = 0, terrainMeters = 0, ascentMeters = 0, descentMeters = 0, totalCost = 0;
  let maxSlopeDeg = grid.slope[cells[0]];
  if (cellBlockReason(grid, cells[0], p.maxSlopeDeg)) throw new Error("Invalid starting cell in path");
  for (let i = 1; i < cells.length; i++) {
    const edge = evaluateEdge(grid, cells[i - 1], cells[i], p);
    if (!edge) throw new Error(`Invalid route edge ${i - 1}`);
    horizontalMeters += edge.horizontalMeters;
    terrainMeters += Math.hypot(edge.horizontalMeters, edge.deltaElevationMeters);
    ascentMeters += Math.max(0, edge.deltaElevationMeters);
    descentMeters += Math.max(0, -edge.deltaElevationMeters);
    totalCost += edge.cost;
    maxSlopeDeg = Math.max(maxSlopeDeg, edge.effectiveSlopeDeg);
    const bin = exposure.find((x) => edge.effectiveSlopeDeg >= x.lowerInclusiveDeg && edge.effectiveSlopeDeg < x.upperExclusiveDeg);
    bin.horizontalMeters += edge.horizontalMeters;
  }
  for (const bin of exposure) bin.fractionOfHorizontalLength = horizontalMeters ? bin.horizontalMeters / horizontalMeters : 0;
  return {
    horizontalMeters,
    terrainMeters,
    ascentMeters,
    descentMeters,
    netElevationMeters: grid.elevation[cells.at(-1)] - grid.elevation[cells[0]],
    maxSlopeDeg,
    totalCost,
    exposure
  };
}
function planRoute(grid, start, goal, options) {
  const began = performance.now();
  let parameters = null;
  let expandedCells = 0, discoveredCells = 0, peakOpenCells = 0;
  const base = () => ({
    engineVersion: ENGINE_VERSION,
    dataset: grid.dataset,
    parameters,
    start,
    goal,
    computeTimeMs: performance.now() - began,
    expandedCells,
    discoveredCells,
    peakOpenCells
  });
  try {
    assertGrid(grid);
  } catch (error) {
    return { ...base(), status: "invalid-grid", reason: String(error) };
  }
  try {
    parameters = normalizeOptions(options);
    const worstCost = Math.hypot(grid.transform[1], grid.transform[5]) * (1 + parameters.lambda * (parameters.maxSlopeDeg / parameters.thetaRefDeg) ** 2) * grid.valid.length;
    if (!Number.isFinite(worstCost)) throw new Error("Cost would overflow");
  } catch (error) {
    return { ...base(), status: "invalid-parameters", reason: String(error) };
  }
  for (const [which, cell] of [["start", start], ["goal", goal]]) {
    const reason = !inBounds(grid, cell) ? "out-of-bounds-or-noninteger" : cellBlockReason(grid, indexOf(grid, cell), parameters.maxSlopeDeg);
    if (reason) return { ...base(), status: which === "start" ? "invalid-start" : "invalid-goal", reason };
  }
  const n = grid.width * grid.height, source = indexOf(grid, start), target = indexOf(grid, goal);
  const g = new Float64Array(n).fill(Infinity), parent = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const open = new BinaryMinHeap(n);
  const heuristic = (col, row) => Math.hypot((col - goal.col) * grid.transform[1], (row - goal.row) * grid.transform[5]);
  g[source] = 0;
  open.set(source, heuristic(start.col, start.row), heuristic(start.col, start.row));
  discoveredCells = 1;
  peakOpenCells = 1;
  while (open.size) {
    const current = open.pop();
    closed[current] = 1;
    expandedCells++;
    if (current === target) {
      const cells = [];
      for (let at = target; at !== -1; at = parent[at]) cells.push(at);
      cells.reverse();
      const metrics = computeMetrics(grid, cells, parameters);
      return { ...base(), status: "success", parameters, cells, metrics };
    }
    const row = Math.floor(current / grid.width), col = current % grid.width;
    for (const [dc, dr] of NEIGHBOURS) {
      const nc = col + dc, nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= grid.width || nr >= grid.height) continue;
      const next = nr * grid.width + nc;
      if (closed[next]) continue;
      const edge = evaluateEdge(grid, current, next, parameters);
      if (!edge) continue;
      const candidate = g[current] + edge.cost;
      if (candidate < g[next]) {
        if (g[next] === Infinity) discoveredCells++;
        g[next] = candidate;
        parent[next] = current;
        const h = heuristic(nc, nr);
        open.set(next, candidate + h, h);
      }
    }
    peakOpenCells = Math.max(peakOpenCells, open.size);
  }
  return { ...base(), status: "no-route", reason: "No connected path under the configured topographic constraints" };
}

// lib/routing/worker-protocol.ts
function installRoutingWorker(scope) {
  let grid = null;
  scope.addEventListener("message", ({ data }) => {
    try {
      if (data.type === "init") {
        assertGrid(data.grid);
        grid = data.grid;
        scope.postMessage({ type: "ready" });
      } else if (data.type === "route") {
        if (!grid) throw new Error("Worker dataset not initialized");
        scope.postMessage({ type: "started", requestId: data.requestId });
        scope.postMessage({ type: "result", requestId: data.requestId, result: planRoute(grid, data.start, data.goal, data.options) });
      } else throw new Error("Unknown worker message");
    } catch (error) {
      scope.postMessage({ type: "error", requestId: data.type === "route" ? data.requestId : null, message: String(error) });
    }
  });
}

// workers/routing.worker.ts
installRoutingWorker(globalThis);
//# sourceMappingURL=routing.worker.js.map
