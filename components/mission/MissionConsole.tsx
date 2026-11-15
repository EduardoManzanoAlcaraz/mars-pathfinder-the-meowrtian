'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Crosshair, Download, Eye, EyeOff, Flag, Info, Layers, LoaderCircle, Mountain, Orbit, Play, RotateCcw, Route, ShieldAlert, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { loadPreparedGrid } from '../../lib/routing/load-grid';
import { adaptBrowserWorker, RoutingWorkerClient } from '../../lib/routing/worker-client';
import { cellBlockReason, cellCenter, indexOf } from '../../lib/routing/grid';
import type { Cell, RouteResult, RouteSuccess, RoutingGrid, XY } from '../../lib/routing/types';
import { DATA_URL, makeRouteExport, marsLonLat, selectEndpoint, validateCatalog } from '../../lib/map/model';
import type { Endpoint, LayerId, VisualCatalog } from '../../lib/map/model';
import ElevationProfile from './ElevationProfile';
import { loadScience } from '../../lib/science/model';
import type { ScienceData, ScienceObjective, ScienceSelection } from '../../lib/science/model';
import { ScienceControls } from './SciencePanel';
import { compareRoutes } from '../../lib/map/route-comparison';
import { LAYER_COPY, englishScienceText } from '../../lib/map/display-copy';

const MissionMap = dynamic(() => import('./MissionMap'), { ssr: false, loading: () => <div className="map-skeleton"><span className="loading-ring" />Preparing cartography</div> });
type Runtime = { grid: RoutingGrid; catalog: VisualCatalog; demo: { start: Cell; goal: Cell; manifestSha256: string } };
type Routes = { a: RouteSuccess | null; b: RouteSuccess | null };
type Notice = { type: 'info' | 'error' | 'success'; text: string } | null;
type CalcState = 'idle' | 'working' | 'complete' | 'no-route' | 'error' | 'cancelled';
const number = (value: number, decimals = 1) => value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export default function MissionConsole() {
  const [runtime, setRuntime] = useState<Runtime | null>(null), [loadError, setLoadError] = useState('');
  const [origin, setOrigin] = useState<Endpoint | null>(null), [destination, setDestination] = useState<Endpoint | null>(null);
  const [mode, setMode] = useState<'start' | 'goal' | null>('start');
  const [lambda, setLambda] = useState(4), [maxSlope, setMaxSlope] = useState(15);
  const [activeLayer, setActiveLayer] = useState<LayerId>('ortho'), [showNoData, setShowNoData] = useState(true);
  const [visibility, setVisibility] = useState({ a: true, b: true });
  const [routes, setRoutes] = useState<Routes>({ a: null, b: null });
  const [selected, setSelected] = useState<'a' | 'b'>('b'), [calcState, setCalcState] = useState<CalcState>('idle');
  const [notice, setNotice] = useState<Notice>(null), [mapReady, setMapReady] = useState(false), [sourcesOpen, setSourcesOpen] = useState(false);
  const clients = useRef<{ a: RoutingWorkerClient; b: RoutingWorkerClient } | null>(null), generation = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const [science, setScience] = useState<ScienceData | null>(null), [scienceError, setScienceError] = useState('');
  const [showGeology, setShowGeology] = useState(false), [showObjectives, setShowObjectives] = useState(true), [showPhotos, setShowPhotos] = useState(false);
  const [geologyOpacity, setGeologyOpacity] = useState(.35), [scienceSelection, setScienceSelection] = useState<ScienceSelection>(null);
  const [focusVersion, setFocusVersion] = useState(0), [demoState, setDemoState] = useState<'idle' | 'running' | 'complete'>('idle');

  useEffect(() => {
    const abort = new AbortController();
    const json = async (name: string) => {
      const response = await fetch(DATA_URL + name, { signal: abort.signal });
      if (!response.ok) throw new Error(`Could not load ${name} (${response.status}).`);
      return response.json();
    };
    Promise.all([loadPreparedGrid(DATA_URL + 'manifest.json', abort.signal), json('visuals.json') as Promise<VisualCatalog>, json('demo-query.json') as Promise<Runtime['demo']>])
      .then(([grid, catalog, demo]) => {
        validateCatalog(catalog, grid);
        if (demo.manifestSha256 !== grid.dataset.manifestSha256) throw new Error('The example belongs to a different terrain version.');
        if (!abort.signal.aborted) setRuntime({ grid, catalog, demo });
      }).catch(error => { if (!abort.signal.aborted) setLoadError(String(error)); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!runtime) return;
    const abort = new AbortController();
    loadScience(runtime.grid, abort.signal).then(data => { if (!abort.signal.aborted) setScience(data); })
      .catch(error => { if (!abort.signal.aborted) setScienceError(`Scientific context unavailable: ${String(error)}`); });
    return () => abort.abort();
  }, [runtime]);
  useEffect(() => {
    if (!runtime) return;
    const factory = () => adaptBrowserWorker(new Worker('/workers/routing.worker.js', { type: 'module' }));
    clients.current = { a: new RoutingWorkerClient(runtime.grid, factory), b: new RoutingWorkerClient(runtime.grid, factory) };
    return () => { generation.current++; clients.current?.a.dispose(); clients.current?.b.dispose(); clients.current = null; };
  }, [runtime]);
  useEffect(() => {
    if (sourcesOpen && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!sourcesOpen && dialog.current?.open) dialog.current.close();
  }, [sourcesOpen]);
  const invalidate = useCallback(() => {
    generation.current++; clients.current?.a.cancel(); clients.current?.b.cancel();
    setRoutes({ a: null, b: null }); setCalcState('idle'); setDemoState('idle');
  }, []);
  const beginSelect = (kind: 'start' | 'goal') => {
    setMode(kind); setNotice(null);
    if (window.innerWidth < 950) document.getElementById('map-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const pick = (xy: XY) => {
    if (!runtime || !mode) return;
    const result = selectEndpoint(runtime.grid, xy, maxSlope);
    if (result.error) { setNotice({ type: 'error', text: result.error }); return; }
    invalidate(); setNotice(null);
    if (mode === 'start') { setOrigin(result.endpoint); setMode(destination ? null : 'goal'); }
    else { setDestination(result.endpoint); setMode(null); }
  };
  const loadExample = () => {
    if (!runtime) return;
    invalidate(); setLambda(4); setMaxSlope(15);
    const start = cellCenter(runtime.grid, runtime.demo.start), goal = cellCenter(runtime.grid, runtime.demo.goal);
    setOrigin(selectEndpoint(runtime.grid, start, 15).endpoint); setDestination(selectEndpoint(runtime.grid, goal, 15).endpoint);
    setMode(null); setNotice({ type: 'info', text: 'Validated example endpoints. Parameters: 15° and λ = 4. Calculate to obtain fresh routes.' });
  };
  const reset = () => { invalidate(); setOrigin(null); setDestination(null); setMode('start'); setNotice(null); };
  const selectScience = (selection: ScienceSelection) => {
    setScienceSelection(selection); setMode(null);
    if (selection) {
      const workspace = document.getElementById('map-workspace');
      const frame = workspace?.querySelector('.map-stage')?.getBoundingClientRect();
      // Sidebar cards can sit below the fold on desktop too. Bring the actual map
      // back into view; closing a card should preserve the user's scroll position.
      if (workspace && frame && (frame.top < 0 || frame.top > window.innerHeight - 240)) workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const assignObjective = (objective: ScienceObjective, kind: 'start' | 'goal') => {
    if (!runtime) return;
    const result = selectEndpoint(runtime.grid, { x: objective.xy[0], y: objective.xy[1] }, maxSlope);
    if (result.error) { setNotice({ type: 'error', text: result.error }); return; }
    invalidate(); if (kind === 'start') setOrigin(result.endpoint); else setDestination(result.endpoint);
    setScienceSelection(null); setMode(null); setNotice({ type: 'info', text: `${objective.label.split(' · ')[0]} assigned as ${kind === 'start' ? 'origin' : 'destination'}. Team-selected objective; geological uncertainty 100–200 m.` });
  };
  const cancel = () => { invalidate(); setCalcState('cancelled'); setNotice({ type: 'info', text: 'Calculation cancelled. Active workers have been terminated.' }); };
  const endpointProblem = runtime && ((origin && cellBlockReason(runtime.grid, indexOf(runtime.grid, origin.cell), maxSlope)) || (destination && cellBlockReason(runtime.grid, indexOf(runtime.grid, destination.cell), maxSlope)));
  const runRoutes = async (start: Endpoint, goal: Endpoint, weight: number, cap: number, guided = false) => {
    if (!runtime || !clients.current || cellBlockReason(runtime.grid, indexOf(runtime.grid, start.cell), cap) || cellBlockReason(runtime.grid, indexOf(runtime.grid, goal.cell), cap)) return;
    const pair = clients.current, token = ++generation.current;
    pair.a.cancel(); pair.b.cancel(); setRoutes({ a: null, b: null }); setCalcState('working'); setMode(null); setNotice(null);
    const outcomes = await Promise.all([
      pair.a.request(start.cell, goal.cell, { mode: 'distance', lambda: 0, maxSlopeDeg: cap, thetaRefDeg: 15 }),
      pair.b.request(start.cell, goal.cell, { mode: 'slope-penalty', lambda: weight, maxSlopeDeg: cap, thetaRefDeg: 15 }),
    ]);
    if (token !== generation.current) return;
    const next: Routes = { a: null, b: null }; const failures: string[] = [];
    for (const [index, outcome] of outcomes.entries()) {
      const key = index === 0 ? 'a' : 'b', client = pair[key];
      if (outcome.status === 'cancelled' || !client.isCurrent(outcome.requestId)) return;
      if (outcome.status === 'error') failures.push(outcome.message);
      else if (outcome.result.status === 'success') next[key] = outcome.result;
      else failures.push(routeFailure(outcome.result));
    }
    setRoutes(next);
    if (next.a && next.b) { setCalcState('complete'); setNotice(null); if (guided) setDemoState('complete'); }
    else { setDemoState('idle'); setCalcState(failures.some(x => x.includes('No route exists')) ? 'no-route' : 'error'); setNotice({ type: 'error', text: [...new Set(failures)].join(' ') }); }
  };
  const calculate = () => { if (origin && destination && !endpointProblem) void runRoutes(origin, destination, lambda, maxSlope); };
  const startMission = () => {
    const target = science?.objectives.find(o => o.id === 'meowrtian-njf');
    if (!runtime || !mapReady || !clients.current || !target) return;
    const start = selectEndpoint(runtime.grid, cellCenter(runtime.grid, runtime.demo.start), 15);
    // Same origin-to-M3 experiment independently audited in production and used
    // in the presentation. Coordinates come from the verified objective record.
    const goal = selectEndpoint(runtime.grid, { x: target.xy[0], y: target.xy[1] }, 15);
    if (start.error || goal.error || !start.endpoint || !goal.endpoint) { setNotice({ type: 'error', text: start.error ?? goal.error ?? 'Validated scenario unavailable.' }); return; }
    invalidate(); setLambda(4); setMaxSlope(15); setOrigin(start.endpoint); setDestination(goal.endpoint); setMode(null);
    setActiveLayer('ortho'); setShowNoData(true); setShowGeology(false); setShowObjectives(true); setShowPhotos(false);
    setVisibility({ a: true, b: true }); setSelected('b'); setScienceSelection(null); setFocusVersion(v => v + 1); setDemoState('running');
    document.getElementById('map-workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    void runRoutes(start.endpoint, goal.endpoint, 4, 15, true);
  };
  useEffect(() => {
    if (demoState !== 'complete') return;
    const frame = requestAnimationFrame(() => document.getElementById('route-comparison')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    return () => cancelAnimationFrame(frame);
  }, [demoState]);
  const exportRoute = () => {
    if (!runtime || !origin || !destination || !routes[selected]) return;
    const content = { ...makeRouteExport(runtime.grid, routes[selected]!, origin, destination, selected), scientificContext: science ? {
      datasetId: science.manifest.datasetId, manifestSha256: science.manifestSha256, geologySource: science.geology.source,
      geologyUse: 'Context only; excluded from routing constraints and cost', registration: { ...science.geology.registration, warningEn: englishScienceText(science.geology.registration.warningEs) },
      endpointCellAssociations: science.objectives.filter(o => [origin, destination].some(e => e.cell.col === o.cell.col && e.cell.row === o.cell.row)).map(o => ({ id: o.id, designation: o.designation, designationEn: englishScienceText(o.designation), sourceFid: o.sourceFid, unitSymbol: o.unitSymbol, uncertainty: o.uncertainty })),
    } : null };
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `mars-pathfinder-${runtime.grid.dataset.id}-route-${selected}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const dataReady = !!runtime && mapReady;
  const successful = !!routes.a && !!routes.b;
  return <div className="mission-app" data-calculation-state={calcState}>
    <header className="app-header">
      <a className="brand" href="/" aria-label="Mars Pathfinder home"><span className="brand-icon"><Orbit size={25} strokeWidth={1.4} /></span><span><strong>MARS<span>PATHFINDER</span></strong><small>THE MEOWRTIAN</small></span></a>
      <nav className="header-nav"><span className="nav-active">Mission planner</span><button onClick={() => setSourcesOpen(true)}>Sources and method <Info size={13} /></button></nav>
      <div className="header-meta"><span className={`data-badge ${dataReady ? 'verified' : ''}`}><i />{loadError ? 'Data error' : dataReady ? 'HiRISE verified' : 'Preparing data'}</span><span className="space-apps">NASA SPACE APPS <b>2026</b></span></div>
    </header>

    <main className="mission-content">
      <aside className="mission-sidebar" id="mission-controls">
        <div className="sidebar-heading"><span className="eyebrow">SURFACE EXPLORATION</span><h1>Your next<br /> route on Mars<span>.</span></h1><p>Two routes. One terrain.<br /> Plan with real Jezero data.</p></div>
        <section className="control-section">
          <div className="section-heading"><span>01</span><h2>Define the traverse</h2><Crosshair size={14} /></div>
          <EndpointButton kind="start" endpoint={origin} active={mode === 'start'} grid={runtime?.grid ?? null} onClick={() => beginSelect('start')} />
          <div className="endpoint-connector"><i /><i /><i /></div>
          <EndpointButton kind="goal" endpoint={destination} active={mode === 'goal'} grid={runtime?.grid ?? null} onClick={() => beginSelect('goal')} />
          <button className="example-button" onClick={loadExample} disabled={!dataReady}><Sparkles size={13} />Load validated example<ChevronRight size={13} /></button>
        </section>

        <section className="control-section parameters">
          <div className="section-heading"><span>02</span><h2>Adjust the model</h2><SlidersHorizontal size={14} /></div>
          <div className="parameter-label"><label htmlFor="lambda">Slope penalty</label><output htmlFor="lambda">λ {number(lambda, 1)}</output></div>
          <input id="lambda" type="range" min="0" max="10" step="0.5" value={lambda} onChange={event => { invalidate(); setLambda(Number(event.target.value)); setNotice(null); }} aria-label="Route B lambda" />
          <div className="range-ends"><span>Prioritize distance</span><span>Penalize slopes</span></div>
          <div className="slope-control"><span><Mountain size={14} />Maximum slope</span><select aria-label="Slope limit" value={maxSlope} onChange={event => { invalidate(); setMaxSlope(Number(event.target.value)); setNotice(null); }}>{[5, 10, 15, 20, 25, 30].map(value => <option key={value} value={value}>{value}°</option>)}</select></div>
          <p className="parameter-note">Limit applies to cells and edges. NoData and blocked corners are excluded.</p>
          {endpointProblem && <p className="inline-error">An endpoint exceeds the current limit. Select another cell or review the threshold.</p>}
        </section>

        <div className="mission-actions">
          <button className="calculate-button" onClick={calculate} disabled={!dataReady || !origin || !destination || !!endpointProblem || calcState === 'working'}>{calcState === 'working' ? <LoaderCircle size={17} className="spin" /> : <Route size={17} />}<span>{calcState === 'working' ? 'Computing routes' : 'Calculate routes'}</span><ArrowRight size={16} /></button>
          <div className="secondary-actions"><button onClick={reset}><RotateCcw size={13} />Reset</button>{calcState === 'working' ? <button onClick={cancel}>Cancel calculation</button> : <span>Grid · 10 m</span>}</div>
        </div>

        <section className="control-section layer-controls">
          <div className="section-heading"><span>03</span><h2>Explore layers</h2><Layers size={14} /></div>
          <div className="layer-options" role="radiogroup" aria-label="Base layer">
            {(['ortho', 'hillshade', 'elevation', 'slope'] as const).map(id => <button role="radio" aria-checked={activeLayer === id} key={id} className={activeLayer === id ? 'active' : ''} onClick={() => setActiveLayer(id)}><span className={`layer-swatch ${id}`} /><span>{({ ortho: 'Orthoimage', hillshade: 'Hillshade', elevation: 'Elevation', slope: 'Slope' })[id]}</span>{activeLayer === id && <Check size={13} />}</button>)}
          </div>
          <label className="mask-toggle"><input type="checkbox" checked={showNoData} onChange={event => setShowNoData(event.target.checked)} /><span className="mask-dot" />Show NoData areas</label>
          <button className="source-link" onClick={() => setSourcesOpen(true)}><Info size={12} />Provenance and resolution<ChevronRight size={12} /></button>
        </section>
        <ScienceControls science={science} error={scienceError} showGeology={showGeology} showObjectives={showObjectives} showPhotos={showPhotos} opacity={geologyOpacity}
          onGeology={value => { setShowGeology(value); if (value) setMode(null); }} onObjectives={setShowObjectives} onPhotos={setShowPhotos} onOpacity={setGeologyOpacity} onSelect={selectScience} />
      </aside>

      <section className="workspace" id="map-workspace">
        <div className="workspace-heading"><div><span className="eyebrow">MARS / JEZERO CRATER</span><h2>Plan the traverse. Explore the science.</h2></div><div className="region-meta"><span>18.45° N · 77.44° E</span><b>HiRISE / v1</b></div></div>
        <section lang="en" className="mission-briefing" aria-label="Guided mission demo" data-demo-state={demoState}>
          <div><span className="eyebrow">MISSION BRIEF / THE MEOWRTIAN</span><h3>One terrain. Two ways across.</h3><p>Plan a traverse to M3, our team-selected crater-floor objective. Compare distance and slope on real Mars data.</p></div>
          <button className="start-mission" onClick={startMission} disabled={!dataReady || !science || calcState === 'working'}>{demoState === 'running' ? <LoaderCircle className="spin" size={18} /> : <Play size={18} />}<span>{demoState === 'running' ? 'Computing A + B…' : 'Start Mission'}<small>{scienceError ? 'Science unavailable · use manual planner' : !science ? 'Verifying science objectives…' : 'Validated origin → M3 · 15° / λ 4'}</small></span><ArrowRight size={16} /></button>
          <ol className="mission-steps" aria-label="Demo progress"><li className={dataReady ? 'done' : ''}>01 / Real terrain</li><li className={demoState === 'complete' ? 'done' : ''}>02 / Compare A + B</li><li><button disabled={!science} onClick={() => science && selectScience({ kind: 'objective', id: science.objectives[0]!.id })}>03 / Inspect M1–M3 ↗</button></li></ol>
        </section>
        <div className="science-map-shortcuts" aria-label="Scientific map layers">
          <button disabled={!science} aria-pressed={showGeology} onClick={() => { setShowGeology(value => !value); setMode(null); }}><Layers size={13} />USGS geology <small>1:75,000</small></button>
          <button disabled={!science} aria-pressed={showObjectives} onClick={() => setShowObjectives(value => !value)}><Flag size={13} />Objectives M1–M3</button>
          <button disabled={!science} aria-pressed={showPhotos} onClick={() => setShowPhotos(value => !value)}><Eye size={13} />Perseverance records</button>
        </div>
        <div className="map-stage">
          {runtime ? <MissionMap grid={runtime.grid} catalog={runtime.catalog} activeLayer={activeLayer} selectionMode={mode} origin={origin} destination={destination} routes={routes} visibility={visibility} showNoData={showNoData} focusVersion={focusVersion}
            science={science} showGeology={showGeology} showObjectives={showObjectives} showPhotos={showPhotos} geologyOpacity={geologyOpacity} scienceSelection={scienceSelection} onScienceSelect={selectScience} onAssignObjective={assignObjective}
            onPick={pick} onReady={() => setMapReady(true)} onError={message => setNotice({ type: 'error', text: message })} onSources={() => setSourcesOpen(true)} />
            : <div className="map-skeleton">{loadError ? <><ShieldAlert size={27} /><strong>Could not verify the data</strong><p>{loadError}</p><button onClick={() => location.reload()}>Retry</button></> : <><span className="loading-ring" /><strong>Connecting to real terrain</strong><p>Verifying the Jezero version, masks and binaries.</p></>}</div>}
        </div>
        <div className={`mission-notice ${notice?.type ?? 'info'}`} role={notice?.type === 'error' ? 'alert' : 'status'} aria-live="polite">
          {notice?.type === 'error' ? <ShieldAlert size={14} /> : successful ? <Check size={14} /> : <Crosshair size={14} />}
          <span>{notice?.text ?? (calcState === 'working' ? 'Both workers are computing. You can continue exploring the map.' : successful ? 'Two routes computed on the topographic model. Compare their metrics.' : !origin ? 'Choose an origin on the map or load the validated example.' : !destination ? 'Now choose the destination. Points snap to the center of their 10 m cell.' : 'Endpoints ready. Calculate both routes with the same constraints.')}</span>
          <a href="#mission-controls" className="mobile-control-link">Controls</a>
        </div>

        <div id="route-comparison" className="comparison-workspace">
        {successful && <div lang="en" className="route-insight" role="status" data-testid="route-insight"><span className="eyebrow">THE TRADE-OFF / MEASURED, NOT ASSUMED</span><p>{compareRoutes(routes.a!, routes.b!)}</p><button onClick={() => document.querySelector('.map-stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>View routes on terrain <ArrowRight size={13} /></button></div>}
        <div className="results-row">
          <section className="results-panel">
            <div className="panel-heading"><h2 lang="en">Compare the traverses</h2><button className="export-button" onClick={exportRoute} disabled={!routes[selected]} title={`Export route record ${selected.toUpperCase()}`}><Download size={13} />Export JSON</button></div>
            <div className="route-summary"><div className="summary-label">SAME ENDPOINTS<br />SAME CONSTRAINTS</div>{(['a', 'b'] as const).map(id => <div className={`route-summary-cell route-${id}`} key={id}>
              <div className="route-title"><button onClick={() => setSelected(id)} aria-label={`View route profile ${id.toUpperCase()}`} className={selected === id ? 'selected' : ''}><i />Route {id.toUpperCase()}</button><button className="visibility-button" aria-label={`${visibility[id] ? 'Hide' : 'Show'} Route ${id.toUpperCase()}`} aria-pressed={visibility[id]} onClick={() => setVisibility(value => ({ ...value, [id]: !value[id] }))}>{visibility[id] ? <Eye size={12} /> : <EyeOff size={12} />}</button></div>
              <b className="route-mode">{id === 'a' ? 'Shortest' : 'Slope-aware'}</b>
              <small>{id === 'a' ? 'Minimum distance · λ 0' : `Slope · λ ${number(routes[id]?.parameters.lambda ?? lambda, 1)}`}</small>
              <strong data-testid={`${id}-horizontalMeters`} data-value={routes[id]?.metrics.horizontalMeters ?? ''}>{routes[id] ? number(routes[id]!.metrics.horizontalMeters / 1000, 2) : '—'} <span>km</span></strong>
            </div>)}</div>
            <table className="metrics-table"><thead className="sr-only"><tr><th>Metric</th><th>Route A</th><th>Route B</th></tr></thead><tbody>
              {([['horizontalMeters', 'Horizontal distance', 'm'], ['terrainMeters', 'Terrain distance ≈', 'm'], ['ascentMeters', 'Elevation gain', 'm'], ['descentMeters', 'Descent', 'm'], ['maxSlopeDeg', 'Max modeled slope', '°'], ['totalCost', 'Model cost', 'weighted m']] as const).map(([key, label, unit]) => <tr key={key}><th scope="row">{label}</th>{(['a', 'b'] as const).map(id => <td key={id} data-testid={`${id}-${key}${key === 'horizontalMeters' ? '-detail' : ''}`} data-value={routes[id]?.metrics[key] ?? ''}>{routes[id] ? `${number(routes[id]!.metrics[key], key === 'maxSlopeDeg' ? 2 : 1)} ${unit}` : '—'}</td>)}</tr>)}
              <tr><th scope="row">Compute time</th>{(['a', 'b'] as const).map(id => <td key={id} data-testid={`${id}-computeTimeMs`} data-value={routes[id]?.computeTimeMs ?? ''}>{routes[id] ? `${number(routes[id]!.computeTimeMs, 1)} ms` : '—'}</td>)}</tr>
            </tbody></table>
          </section>
          <section className="profile-panel"><div className="panel-heading"><h2>Elevation profile</h2><div className="profile-tabs" role="group" aria-label="Profile route">{(['a', 'b'] as const).map(id => <button key={id} aria-pressed={selected === id} className={`route-${id} ${selected === id ? 'active' : ''}`} onClick={() => setSelected(id)}>Route {id.toUpperCase()}</button>)}</div></div>{runtime ? <ElevationProfile grid={runtime.grid} route={routes[selected]} selected={selected} /> : <div className="profile-empty">Preparing elevation data</div>}</section>
        </div>
        </div>
        <footer className="workspace-footer"><span><span className="tiny-dot" />{dataReady ? 'Real data · derivatives identified' : 'Preparing scientific data'}</span><span><ShieldAlert size={12} />Model optimization. No EVA safety certification.</span></footer>
        <p className="model-limitations" role="note">Educational prototype on 10 m cells. It does not assess soil stability, sand, small rocks, radiation or EVA endurance. Neither route certifies astronaut safety.</p>
      </section>
    </main>

    <dialog ref={dialog} className="sources-dialog" onCancel={() => setSourcesOpen(false)}>
      <div className="dialog-heading"><div><span className="eyebrow">SCIENTIFIC TRANSPARENCY</span><h2>The terrain behind the map</h2></div><button className="icon-button" aria-label="Close sources" onClick={() => setSourcesOpen(false)}><X size={20} /></button></div>
      <p>A specific region of Jezero. Real orbital observations, documented derivatives and explicit planning assumptions.</p>
      {runtime && <><div className="source-summary"><div><small>ORBITAL DATA</small><strong>MRO · HiRISE</strong><span>NASA / JPL / University of Arizona</span></div><div><small>TERRAIN VERSION</small><strong>{runtime.grid.dataset.id}</strong><span>Local Martian CRS · meters</span></div></div>
        <div className="source-layer-list">{runtime.catalog.layers.map(layer => <div key={layer.id}><span className={`layer-swatch ${layer.id}`} /><div><strong>{LAYER_COPY[layer.id].title}</strong><p>{LAYER_COPY[layer.id].provenance}</p></div><span>{layer.displayResolutionM} m visual<br /><small>{layer.sourceResolutionM} m base</small></span></div>)}</div>
        <div className="source-explanation"><h3>What these layers mean</h3><p>The RED_C orthoimage is monochrome. The DEM comes from orbital stereo. Slopes and hillshade are The Meowrtian derivatives; hillshade illumination is synthetic (315° / 45°).</p><p>The routing grid is 10 m: it uses mean elevation, maximum slope per cell and a conservative mask. Display resolution does not certify metric accuracy or physical safety.</p><p>Purple areas are excluded because valid data are missing. The slope limits and λ are team assumptions, not NASA operational limits.</p><p>The overview shows floor and fan units from the same USGS SIM 3464 database, simplified for regional context; it omits other units and does not trace the crater rim. The orange rectangle is the HiRISE crop; the white rectangle is the current view. Navigation is unavailable outside that crop.</p></div>
        <details><summary>Product identity and references</summary><code className="manifest-hash">Manifest SHA-256<br />{runtime.grid.dataset.manifestSha256}</code><code className="crs-code">{runtime.grid.dataset.crsProj}</code><ul>{runtime.catalog.sourceProducts.map(product => <li key={product.name}><a href={product.url} target="_blank" rel="noreferrer">{product.name}</a></li>)}</ul><p className="parameter-note">The orthoimage is georeferenced through its official LBL. Stereo-data and mask limitations are retained.</p></details>
      </>}
      <div className="source-explanation"><h3>Geology and surface records</h3><p>USGS SIM 3464 — Sun &amp; Stack (2020), scale 1:75,000. Published interpretation with documented 100–200 m offsets against the operations CTX mosaic; excluded from A* costs and barriers. M1–M3 are team selections, not official stations.</p><p>Navcam photographs: NASA/JPL-Caltech. Rover position matched by sol and RMC to official waypoints; photographed targets are not located. Mars Trek was consulted to assess coverage and complementary products; its rasters are not incorporated.</p><a className="science-reference" href="https://doi.org/10.3133/sim3464" target="_blank" rel="noreferrer">USGS SIM 3464 ↗</a><a className="science-reference" href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Material and software credits and licenses ↗</a></div>
      <div className="dialog-footer"><Info size={15} /><p>Orbital data, geological interpretation and rover records, with their uncertainties. Reprojection, objectives and routes derived by The Meowrtian; no NASA/USGS operational endorsement.</p></div>
    </dialog>
  </div>;
}

function EndpointButton({ kind, endpoint, active, grid, onClick }: { kind: 'start' | 'goal'; endpoint: Endpoint | null; active: boolean; grid: RoutingGrid | null; onClick: () => void }) {
  const coordinates = endpoint && grid ? marsLonLat(grid, endpoint.center) : null;
  return <button className={`endpoint-button ${active ? 'active' : ''} ${endpoint ? 'has-point' : ''}`} onClick={onClick} aria-label={kind === 'start' ? 'Select origin' : 'Select destination'} aria-pressed={active}>
    <span className={`endpoint-icon ${kind}`}>{kind === 'start' ? <Crosshair size={18} /> : <Flag size={17} />}</span><span className="endpoint-copy"><strong>{kind === 'start' ? 'Origin' : 'Destination'}</strong>
      {endpoint && coordinates ? <><span className="endpoint-coordinates">{coordinates.latitudeNorthDeg.toFixed(5)}° N · {coordinates.longitudeEastDeg.toFixed(5)}° E</span><small>Cell {endpoint.cell.col}, {endpoint.cell.row} · snap {number(endpoint.snapMeters)} m</small></> : <span>Click on the map</span>}</span>{endpoint ? <Check className="endpoint-check" size={13} /> : <span className="endpoint-index">{kind === 'start' ? '1' : '2'}</span>}
  </button>;
}
function routeFailure(result: RouteResult): string {
  if (result.status === 'no-route') return 'No route exists between these endpoints under the current constraints. Try another selection or review the slope limit.';
  if (result.status === 'invalid-start' || result.status === 'invalid-goal') return 'An endpoint fails the constraints. Select another cell; it has not been moved automatically.';
  return 'Could not complete the calculation. Review the parameters and try again.';
}
