/** Indexed binary min-heap: at most one open entry per cell, real decrease-key. */
export class BinaryMinHeap {
  private nodes: number[] = [];
  private positions: Int32Array;
  private keys: Float64Array;
  private ties: Float64Array;
  constructor(capacity: number) {
    this.positions = new Int32Array(capacity).fill(-1);
    this.keys = new Float64Array(capacity);
    this.ties = new Float64Array(capacity);
  }
  get size(): number { return this.nodes.length; }
  private less(a: number, b: number): boolean {
    return this.keys[a]! < this.keys[b]! || (this.keys[a] === this.keys[b] &&
      (this.ties[a]! < this.ties[b]! || (this.ties[a] === this.ties[b] && a < b)));
  }
  private swap(a: number, b: number): void {
    const x = this.nodes[a]!, y = this.nodes[b]!;
    this.nodes[a] = y; this.nodes[b] = x;
    this.positions[x] = b; this.positions[y] = a;
  }
  private up(position: number): number {
    let p = position;
    while (p > 0) {
      const parent = (p - 1) >>> 1;
      if (!this.less(this.nodes[p]!, this.nodes[parent]!)) break;
      this.swap(p, parent); p = parent;
    }
    return p;
  }
  private down(position: number): void {
    let p = position;
    while (p * 2 + 1 < this.nodes.length) {
      let child = p * 2 + 1;
      if (child + 1 < this.nodes.length && this.less(this.nodes[child + 1]!, this.nodes[child]!)) child++;
      if (!this.less(this.nodes[child]!, this.nodes[p]!)) break;
      this.swap(p, child); p = child;
    }
  }
  set(node: number, key: number, tie = 0): void {
    if (!Number.isInteger(node) || node < 0 || node >= this.positions.length || !Number.isFinite(key) || !Number.isFinite(tie)) throw new Error('Invalid heap entry');
    this.keys[node] = key; this.ties[node] = tie;
    let p = this.positions[node]!;
    if (p < 0) { p = this.nodes.length; this.positions[node] = p; this.nodes.push(node); }
    this.down(this.up(p));
  }
  pop(): number | undefined {
    if (!this.nodes.length) return undefined;
    const root = this.nodes[0]!, last = this.nodes.pop()!;
    this.positions[root] = -1;
    if (this.nodes.length) { this.nodes[0] = last; this.positions[last] = 0; this.down(0); }
    return root;
  }
}
