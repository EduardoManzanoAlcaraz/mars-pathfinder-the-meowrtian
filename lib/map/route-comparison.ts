import type { RouteSuccess } from '../routing/types.js';
/** Describe measured deltas; never promise a direction or physical safety. */
export function compareRoutes(a: RouteSuccess, b: RouteSuccess): string {
  const description = (delta: number, unit: string, more: string, less: string, unchanged: string) =>
    Math.abs(delta) < .005 ? unchanged : `${Math.abs(delta).toFixed(2)} ${unit} ${delta > 0 ? more : less}`;
  const distance = description(b.metrics.horizontalMeters - a.metrics.horizontalMeters, 'm', 'longer', 'shorter', 'equal in horizontal length');
  const gain = description(b.metrics.ascentMeters - a.metrics.ascentMeters, 'm', 'more cumulative ascent', 'less cumulative ascent', 'the same cumulative ascent');
  const slope = description(b.metrics.maxSlopeDeg - a.metrics.maxSlopeDeg, '°', 'higher maximum modeled slope', 'lower maximum modeled slope', 'the same maximum modeled slope');
  return `Compared with Route A, Route B is ${distance}, with ${gain} and ${slope}. These are topographic model results, not a physical safety assessment.`;
}
