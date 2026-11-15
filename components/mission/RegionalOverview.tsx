'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, Crosshair } from 'lucide-react';
import { contextFrame, loadOverview } from '../../lib/map/overview';
import type { RegionalContext } from '../../lib/map/overview';
import type { MapExtent } from '../../lib/map/model';
import type { RoutingGrid } from '../../lib/routing/types';

export default function RegionalOverview({ grid, studyExtent, viewport, onRecenter }: { grid: RoutingGrid; studyExtent: MapExtent; viewport: MapExtent; onRecenter: () => void }) {
  const [context, setContext] = useState<RegionalContext | null>(null), [error, setError] = useState(''), [open, setOpen] = useState(false);
  useEffect(() => { setOpen(window.matchMedia('(min-width: 761px)').matches); }, []);
  useEffect(() => {
    const abort = new AbortController();
    loadOverview(grid, studyExtent, abort.signal).then(data => { if (!abort.signal.aborted) setContext(data); })
      .catch(e => { if (!abort.signal.aborted) setError(String(e)); });
    return () => abort.abort();
  }, [grid, studyExtent]);
  const frame = context ? contextFrame(context.extent) : null;
  return <aside lang="en" className={`regional-overview ${open ? 'is-open' : ''}`} aria-label="Jezero regional context" data-testid="regional-overview" data-overview-ready={!!context}>
    <button className="overview-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}><span>JEZERO / CONTEXT</span><ChevronDown size={12} /></button>
    {open && <div className="overview-body">
      {context && frame ? <>
        <svg viewBox="0 0 280 190" role="img" aria-label="Mapped Jezero floor and fan units, study area and documented rover positions; north up" data-study-extent={JSON.stringify(studyExtent)}>
          <rect width="280" height="190" fill="#101a21" />
          {context.features.map(f => <path key={f.id} d={frame.path(f.geometry)} fill={f.properties.symbol === 'Njf' ? '#3a535a' : '#9d986c'} stroke="#bdd1c333" strokeWidth=".5" fillRule="evenodd"><title>{f.properties.name} · USGS OBJECTID {f.id}</title></path>)}
          <rect {...frame.rect(studyExtent)} fill="#ff784933" stroke="#ff926e" strokeWidth="1.8"><title>Actual HiRISE study area · {((studyExtent[2] - studyExtent[0]) / 1000).toFixed(3)} × {((studyExtent[3] - studyExtent[1]) / 1000).toFixed(3)} km</title></rect>
          <rect {...frame.rect(viewport)} fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="3 2" data-testid="overview-viewport" />
          {context.roverRecords.map(p => { const xy = frame.point(p.xy); return <circle key={p.imageId} cx={xy[0]} cy={xy[1]} r="1.8" fill="#fff"><title>Documented rover pose · sol {p.sol} · RMC {p.rmc}</title></circle>; })}
          <text x="255" y="18" fill="#c6d4d8" fontSize="11">N ↑</text>
          <path d={`M18 164v5h${5000 * frame.scale}v-5`} fill="none" stroke="#c4d2d3" /><text x="18" y="184" fill="#c4d2d3" fontSize="10">5 km</text>
        </svg>
        <div className="overview-key"><span><i className="study-key" />Study area</span><span><i className="fan-key" />Mapped fans</span><span><i className="floor-key" />Crater floor</span><span><i className="rover-key" />Rover records</span></div>
        <button className="overview-recenter" onClick={onRecenter}><Crosshair size={12} />Return to study area</button>
        <p>White outline: current view.<br />Floor/fan units only · not crater rim.<br /><a href={context.source.url} target="_blank" rel="noreferrer">USGS SIM 3464 · 100–200 m offsets ↗</a></p>
      </> : <p role={error ? 'alert' : 'status'}>{error ? 'Context unavailable. The HiRISE planner remains usable.' : 'Loading verified regional context…'}</p>}
    </div>}
  </aside>;
}
