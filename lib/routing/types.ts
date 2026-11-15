export type Affine = readonly [number, number, number, number, number, number];
export interface Cell { col: number; row: number }
export interface XY { x: number; y: number }
export interface DatasetIdentity {
  id: string;
  provenance: 'official-HiRISE-team-derived' | 'synthetic-test-fixture';
  manifestSha256: string;
  assets: Readonly<Record<string, string>>;
  crsWkt: string;
  crsProj: string;
  verticalReference: string;
}
export interface RoutingGrid {
  width: number; height: number;
  transform: Affine;
  nodata: number;
  elevation: Float32Array;
  slope: Float32Array;
  valid: Uint8Array;
  dataset: DatasetIdentity;
}
export interface RouteOptions {
  mode: 'distance' | 'slope-penalty';
  lambda?: number;
  maxSlopeDeg?: number;
  thetaRefDeg?: number;
  exposureBinsDeg?: readonly number[];
}
export interface Parameters {
  mode: RouteOptions['mode']; lambda: number; maxSlopeDeg: number;
  thetaRefDeg: number; exposureBinsDeg: readonly number[];
}
export interface Exposure {
  lowerInclusiveDeg: number; upperExclusiveDeg: number;
  horizontalMeters: number; fractionOfHorizontalLength: number;
}
export interface RouteMetrics {
  horizontalMeters: number; terrainMeters: number;
  ascentMeters: number; descentMeters: number; netElevationMeters: number;
  maxSlopeDeg: number; totalCost: number; exposure: Exposure[];
}
export interface RouteBase {
  engineVersion: string; dataset: DatasetIdentity; parameters: Parameters | null;
  start: Cell; goal: Cell; computeTimeMs: number; expandedCells: number;
  discoveredCells: number; peakOpenCells: number;
}
export interface RouteSuccess extends RouteBase {
  status: 'success'; parameters: Parameters; cells: number[]; metrics: RouteMetrics;
}
export interface RouteFailure extends RouteBase {
  status: 'no-route' | 'invalid-start' | 'invalid-goal' | 'invalid-parameters' | 'invalid-grid';
  reason: string;
}
export type RouteResult = RouteSuccess | RouteFailure;
export interface Edge {
  horizontalMeters: number; deltaElevationMeters: number;
  segmentSlopeDeg: number; effectiveSlopeDeg: number; cost: number;
}
