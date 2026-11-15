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

const MissionMap = dynamic(() => import('./MissionMap'), { ssr: false, loading: () => <div className="map-skeleton"><span className="loading-ring" />Preparando cartografía</div> });
type Runtime = { grid: RoutingGrid; catalog: VisualCatalog; demo: { start: Cell; goal: Cell; manifestSha256: string } };
type Routes = { a: RouteSuccess | null; b: RouteSuccess | null };
type Notice = { type: 'info' | 'error' | 'success'; text: string } | null;
type CalcState = 'idle' | 'working' | 'complete' | 'no-route' | 'error' | 'cancelled';
const number = (value: number, decimals = 1) => value.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

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

  useEffect(() => {
    const abort = new AbortController();
    const json = async (name: string) => {
      const response = await fetch(DATA_URL + name, { signal: abort.signal });
      if (!response.ok) throw new Error(`No se pudo cargar ${name} (${response.status}).`);
      return response.json();
    };
    Promise.all([loadPreparedGrid(DATA_URL + 'manifest.json', abort.signal), json('visuals.json') as Promise<VisualCatalog>, json('demo-query.json') as Promise<Runtime['demo']>])
      .then(([grid, catalog, demo]) => {
        validateCatalog(catalog, grid);
        if (demo.manifestSha256 !== grid.dataset.manifestSha256) throw new Error('El ejemplo pertenece a otra versión del terreno.');
        if (!abort.signal.aborted) setRuntime({ grid, catalog, demo });
      }).catch(error => { if (!abort.signal.aborted) setLoadError(String(error)); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!runtime) return;
    const abort = new AbortController();
    loadScience(runtime.grid, abort.signal).then(data => { if (!abort.signal.aborted) setScience(data); })
      .catch(error => { if (!abort.signal.aborted) setScienceError(`Contexto científico no disponible: ${String(error)}`); });
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
    setRoutes({ a: null, b: null }); setCalcState('idle');
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
    setMode(null); setNotice({ type: 'info', text: 'Extremos del ejemplo validados. Parámetros: 15° y λ = 4. Calcula para obtener rutas nuevas.' });
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
    setScienceSelection(null); setMode(null); setNotice({ type: 'info', text: `${objective.label} asignado como ${kind === 'start' ? 'origen' : 'destino'}. Objetivo del equipo; incertidumbre geológica 100–200 m.` });
  };
  const cancel = () => { invalidate(); setCalcState('cancelled'); setNotice({ type: 'info', text: 'Cálculo cancelado. Los workers activos se han terminado.' }); };
  const endpointProblem = runtime && ((origin && cellBlockReason(runtime.grid, indexOf(runtime.grid, origin.cell), maxSlope)) || (destination && cellBlockReason(runtime.grid, indexOf(runtime.grid, destination.cell), maxSlope)));
  const calculate = async () => {
    if (!runtime || !origin || !destination || !clients.current || endpointProblem) return;
    const pair = clients.current, token = ++generation.current;
    pair.a.cancel(); pair.b.cancel(); setRoutes({ a: null, b: null }); setCalcState('working'); setMode(null); setNotice(null);
    const outcomes = await Promise.all([
      pair.a.request(origin.cell, destination.cell, { mode: 'distance', lambda: 0, maxSlopeDeg: maxSlope, thetaRefDeg: 15 }),
      pair.b.request(origin.cell, destination.cell, { mode: 'slope-penalty', lambda, maxSlopeDeg: maxSlope, thetaRefDeg: 15 }),
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
    if (next.a && next.b) { setCalcState('complete'); setNotice(null); }
    else { setCalcState(failures.some(x => x.includes('No existe')) ? 'no-route' : 'error'); setNotice({ type: 'error', text: [...new Set(failures)].join(' ') }); }
  };
  const exportRoute = () => {
    if (!runtime || !origin || !destination || !routes[selected]) return;
    const content = { ...makeRouteExport(runtime.grid, routes[selected]!, origin, destination, selected), scientificContext: science ? {
      datasetId: science.manifest.datasetId, manifestSha256: science.manifestSha256, geologySource: science.geology.source,
      geologyUse: 'Context only; excluded from routing constraints and cost', registration: science.geology.registration,
      endpointCellAssociations: science.objectives.filter(o => [origin, destination].some(e => e.cell.col === o.cell.col && e.cell.row === o.cell.row)).map(o => ({ id: o.id, designation: o.designation, sourceFid: o.sourceFid, unitSymbol: o.unitSymbol, uncertainty: o.uncertainty })),
    } : null };
    const url = URL.createObjectURL(new Blob([JSON.stringify(content, null, 2) + '\n'], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `mars-pathfinder-${runtime.grid.dataset.id}-route-${selected}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const dataReady = !!runtime && mapReady;
  const successful = !!routes.a && !!routes.b;
  return <div className="mission-app" data-calculation-state={calcState}>
    <header className="app-header">
      <a className="brand" href="/" aria-label="Mars Pathfinder inicio"><span className="brand-icon"><Orbit size={25} strokeWidth={1.4} /></span><span><strong>MARS<span>PATHFINDER</span></strong><small>THE MEOWRTIAN</small></span></a>
      <nav className="header-nav"><span className="nav-active">Planificador de misión</span><button onClick={() => setSourcesOpen(true)}>Fuentes y método <Info size={13} /></button></nav>
      <div className="header-meta"><span className={`data-badge ${dataReady ? 'verified' : ''}`}><i />{loadError ? 'Error de datos' : dataReady ? 'HiRISE verificado' : 'Preparando datos'}</span><span className="space-apps">NASA SPACE APPS <b>2026</b></span></div>
    </header>

    <main className="mission-content">
      <aside className="mission-sidebar" id="mission-controls">
        <div className="sidebar-heading"><span className="eyebrow">EXPLORACIÓN DE SUPERFICIE</span><h1>Tu próxima<br /> ruta en Marte<span>.</span></h1><p>Dos recorridos. Un mismo terreno.<br /> Decide con datos reales de Jezero.</p></div>
        <section className="control-section">
          <div className="section-heading"><span>01</span><h2>Define el recorrido</h2><Crosshair size={14} /></div>
          <EndpointButton kind="start" endpoint={origin} active={mode === 'start'} grid={runtime?.grid ?? null} onClick={() => beginSelect('start')} />
          <div className="endpoint-connector"><i /><i /><i /></div>
          <EndpointButton kind="goal" endpoint={destination} active={mode === 'goal'} grid={runtime?.grid ?? null} onClick={() => beginSelect('goal')} />
          <button className="example-button" onClick={loadExample} disabled={!dataReady}><Sparkles size={13} />Usar ejemplo validado<ChevronRight size={13} /></button>
        </section>

        <section className="control-section parameters">
          <div className="section-heading"><span>02</span><h2>Ajusta el modelo</h2><SlidersHorizontal size={14} /></div>
          <div className="parameter-label"><label htmlFor="lambda">Penalización por pendiente</label><output htmlFor="lambda">λ {number(lambda, 1)}</output></div>
          <input id="lambda" type="range" min="0" max="10" step="0.5" value={lambda} onChange={event => { invalidate(); setLambda(Number(event.target.value)); setNotice(null); }} aria-label="Lambda de la ruta B" />
          <div className="range-ends"><span>Priorizar distancia</span><span>Evitar pendientes</span></div>
          <div className="slope-control"><span><Mountain size={14} />Pendiente máxima</span><select aria-label="Límite de pendiente" value={maxSlope} onChange={event => { invalidate(); setMaxSlope(Number(event.target.value)); setNotice(null); }}>{[5, 10, 15, 20, 25, 30].map(value => <option key={value} value={value}>{value}°</option>)}</select></div>
          <p className="parameter-note">Límite aplicado a celdas y segmentos. Zonas sin datos y esquinas bloqueadas excluidas.</p>
          {endpointProblem && <p className="inline-error">Un extremo supera el límite actual. Selecciona otra celda o revisa el umbral.</p>}
        </section>

        <div className="mission-actions">
          <button className="calculate-button" onClick={calculate} disabled={!dataReady || !origin || !destination || !!endpointProblem || calcState === 'working'}>{calcState === 'working' ? <LoaderCircle size={17} className="spin" /> : <Route size={17} />}<span>{calcState === 'working' ? 'Calculando recorridos' : 'Calcular rutas'}</span><ArrowRight size={16} /></button>
          <div className="secondary-actions"><button onClick={reset}><RotateCcw size={13} />Reiniciar</button>{calcState === 'working' ? <button onClick={cancel}>Cancelar cálculo</button> : <span>Malla · 10 m</span>}</div>
        </div>

        <section className="control-section layer-controls">
          <div className="section-heading"><span>03</span><h2>Explora las capas</h2><Layers size={14} /></div>
          <div className="layer-options" role="radiogroup" aria-label="Capa base">
            {(['ortho', 'hillshade', 'elevation', 'slope'] as const).map(id => <button role="radio" aria-checked={activeLayer === id} key={id} className={activeLayer === id ? 'active' : ''} onClick={() => setActiveLayer(id)}><span className={`layer-swatch ${id}`} /><span>{({ ortho: 'Ortoimagen', hillshade: 'Relieve', elevation: 'Elevación', slope: 'Pendiente' })[id]}</span>{activeLayer === id && <Check size={13} />}</button>)}
          </div>
          <label className="mask-toggle"><input type="checkbox" checked={showNoData} onChange={event => setShowNoData(event.target.checked)} /><span className="mask-dot" />Mostrar zonas sin datos</label>
          <button className="source-link" onClick={() => setSourcesOpen(true)}><Info size={12} />Procedencia y resolución<ChevronRight size={12} /></button>
        </section>
        <ScienceControls science={science} error={scienceError} showGeology={showGeology} showObjectives={showObjectives} showPhotos={showPhotos} opacity={geologyOpacity}
          onGeology={value => { setShowGeology(value); if (value) setMode(null); }} onObjectives={setShowObjectives} onPhotos={setShowPhotos} onOpacity={setGeologyOpacity} onSelect={selectScience} />
      </aside>

      <section className="workspace" id="map-workspace">
        <div className="workspace-heading"><div><span className="eyebrow">ÁREA DE EXPLORACIÓN</span><h2>Jezero, desde otra perspectiva</h2></div><div className="region-meta"><span>18.45° N · 77.44° E</span><b>HiRISE / v1</b></div></div>
        <div className="science-map-shortcuts" aria-label="Capas científicas del mapa">
          <button disabled={!science} aria-pressed={showGeology} onClick={() => { setShowGeology(value => !value); setMode(null); }}><Layers size={13} />Geología USGS <small>1:75.000</small></button>
          <button disabled={!science} aria-pressed={showObjectives} onClick={() => setShowObjectives(value => !value)}><Flag size={13} />Objetivos M1–M3</button>
          <button disabled={!science} aria-pressed={showPhotos} onClick={() => setShowPhotos(value => !value)}><Eye size={13} />Registros Perseverance</button>
        </div>
        <div className="map-stage">
          {runtime ? <MissionMap grid={runtime.grid} catalog={runtime.catalog} activeLayer={activeLayer} selectionMode={mode} origin={origin} destination={destination} routes={routes} visibility={visibility} showNoData={showNoData}
            science={science} showGeology={showGeology} showObjectives={showObjectives} showPhotos={showPhotos} geologyOpacity={geologyOpacity} scienceSelection={scienceSelection} onScienceSelect={selectScience} onAssignObjective={assignObjective}
            onPick={pick} onReady={() => setMapReady(true)} onError={message => setNotice({ type: 'error', text: message })} onSources={() => setSourcesOpen(true)} />
            : <div className="map-skeleton">{loadError ? <><ShieldAlert size={27} /><strong>No se pudieron verificar los datos</strong><p>{loadError}</p><button onClick={() => location.reload()}>Reintentar</button></> : <><span className="loading-ring" /><strong>Conectando con el terreno real</strong><p>Verificando versión, máscaras y binarios de Jezero.</p></>}</div>}
        </div>
        <div className={`mission-notice ${notice?.type ?? 'info'}`} role={notice?.type === 'error' ? 'alert' : 'status'} aria-live="polite">
          {notice?.type === 'error' ? <ShieldAlert size={14} /> : successful ? <Check size={14} /> : <Crosshair size={14} />}
          <span>{notice?.text ?? (calcState === 'working' ? 'Los dos workers están calculando. Puedes seguir explorando el mapa.' : successful ? 'Dos rutas calculadas sobre el modelo topográfico. Compara sus métricas.' : !origin ? 'Elige un punto de partida en el mapa o carga el ejemplo validado.' : !destination ? 'Ahora elige el destino. Los puntos se ajustan al centro de su celda de 10 m.' : 'Extremos preparados. Calcula los dos recorridos con las mismas restricciones.')}</span>
          <a href="#mission-controls" className="mobile-control-link">Controles</a>
        </div>

        <div className="results-row">
          <section className="results-panel">
            <div className="panel-heading"><h2>Compara tus rutas</h2><button className="export-button" onClick={exportRoute} disabled={!routes[selected]} title={`Exportar ficha de ruta ${selected.toUpperCase()}`}><Download size={13} />Exportar JSON</button></div>
            <div className="route-summary"><div className="summary-label">MISMO ORIGEN Y DESTINO</div>{(['a', 'b'] as const).map(id => <div className={`route-summary-cell route-${id}`} key={id}>
              <div className="route-title"><button onClick={() => setSelected(id)} aria-label={`Ver perfil ruta ${id.toUpperCase()}`} className={selected === id ? 'selected' : ''}><i />Ruta {id.toUpperCase()}</button><button className="visibility-button" aria-label={`${visibility[id] ? 'Ocultar' : 'Mostrar'} ruta ${id.toUpperCase()}`} aria-pressed={visibility[id]} onClick={() => setVisibility(value => ({ ...value, [id]: !value[id] }))}>{visibility[id] ? <Eye size={12} /> : <EyeOff size={12} />}</button></div>
              <small>{id === 'a' ? 'Distancia mínima · λ 0' : `Pendiente · λ ${number(routes[id]?.parameters.lambda ?? lambda, 1)}`}</small>
              <strong data-testid={`${id}-horizontalMeters`} data-value={routes[id]?.metrics.horizontalMeters ?? ''}>{routes[id] ? number(routes[id]!.metrics.horizontalMeters / 1000, 2) : '—'} <span>km</span></strong>
            </div>)}</div>
            <table className="metrics-table"><thead className="sr-only"><tr><th>Métrica</th><th>Ruta A</th><th>Ruta B</th></tr></thead><tbody>
              {([['ascentMeters', 'Ascenso', 'm'], ['descentMeters', 'Descenso', 'm'], ['maxSlopeDeg', 'Pendiente máxima', '°'], ['terrainMeters', 'Distancia sobre el terreno', 'm'], ['totalCost', 'Coste topográfico', 'm pond.']] as const).map(([key, label, unit]) => <tr key={key}><th scope="row">{label}</th>{(['a', 'b'] as const).map(id => <td key={id} data-testid={`${id}-${key}`} data-value={routes[id]?.metrics[key] ?? ''}>{routes[id] ? `${number(routes[id]!.metrics[key], key === 'maxSlopeDeg' ? 2 : 1)} ${unit}` : '—'}</td>)}</tr>)}
              <tr><th scope="row">Tiempo de cálculo</th>{(['a', 'b'] as const).map(id => <td key={id} data-testid={`${id}-computeTimeMs`} data-value={routes[id]?.computeTimeMs ?? ''}>{routes[id] ? `${number(routes[id]!.computeTimeMs, 1)} ms` : '—'}</td>)}</tr>
            </tbody></table>
          </section>
          <section className="profile-panel"><div className="panel-heading"><h2>Perfil de elevación</h2><div className="profile-tabs" role="group" aria-label="Recorrido del perfil">{(['a', 'b'] as const).map(id => <button key={id} aria-pressed={selected === id} className={`route-${id} ${selected === id ? 'active' : ''}`} onClick={() => setSelected(id)}>Ruta {id.toUpperCase()}</button>)}</div></div>{runtime ? <ElevationProfile grid={runtime.grid} route={routes[selected]} selected={selected} /> : <div className="profile-empty">Preparando datos de elevación</div>}</section>
        </div>
        <footer className="workspace-footer"><span><span className="tiny-dot" />{dataReady ? 'Datos reales · derivados identificados' : 'Preparando datos científicos'}</span><span><ShieldAlert size={12} />Optimización del modelo. Sin certificación de seguridad EVA.</span></footer>
        <p className="model-limitations" role="note">Prototipo educativo sobre celdas de 10 m. No evalúa estabilidad del suelo, arena, rocas pequeñas, radiación ni autonomía EVA. Ninguno de los dos recorridos certifica seguridad para astronautas.</p>
      </section>
    </main>

    <dialog ref={dialog} className="sources-dialog" onCancel={() => setSourcesOpen(false)}>
      <div className="dialog-heading"><div><span className="eyebrow">TRANSPARENCIA CIENTÍFICA</span><h2>El terreno detrás del mapa</h2></div><button className="icon-button" aria-label="Cerrar fuentes" onClick={() => setSourcesOpen(false)}><X size={20} /></button></div>
      <p>Una región concreta de Jezero. Observaciones orbitales reales, derivados documentados y supuestos de planificación visibles.</p>
      {runtime && <><div className="source-summary"><div><small>DATOS ORBITALES</small><strong>MRO · HiRISE</strong><span>NASA / JPL / University of Arizona</span></div><div><small>VERSIÓN DE TERRENO</small><strong>{runtime.grid.dataset.id}</strong><span>CRS local marciano · metros</span></div></div>
        <div className="source-layer-list">{runtime.catalog.layers.map(layer => <div key={layer.id}><span className={`layer-swatch ${layer.id}`} /><div><strong>{layer.title}</strong><p>{layer.provenance}</p></div><span>{layer.displayResolutionM} m visual<br /><small>{layer.sourceResolutionM} m base</small></span></div>)}</div>
        <div className="source-explanation"><h3>Qué significan estas capas</h3><p>La ortoimagen RED_C es monocroma. El DEM proviene de estéreo orbital. Las pendientes y el sombreado son derivados de The Meowrtian; la luz del relieve es sintética (315° / 45°).</p><p>La malla de rutas es de 10 m: usa elevación media, pendiente máxima por celda y una máscara conservadora. La resolución de visualización no certifica precisión métrica ni seguridad física.</p><p>Las zonas violetas están excluidas por ausencia de datos válidos. Los límites de pendiente y λ son supuestos del equipo, no límites operativos NASA.</p></div>
        <details><summary>Identidad y referencias de los productos</summary><code className="manifest-hash">SHA-256 del manifiesto<br />{runtime.grid.dataset.manifestSha256}</code><code className="crs-code">{runtime.grid.dataset.crsProj}</code><ul>{runtime.catalog.sourceProducts.map(product => <li key={product.name}><a href={product.url} target="_blank" rel="noreferrer">{product.name}</a></li>)}</ul><p className="parameter-note">La ortoimagen se georreferencia mediante su LBL oficial. Se conservan las limitaciones de los datos estéreo y de las máscaras.</p></details>
      </>}
      <div className="source-explanation"><h3>Geología y registros de superficie</h3><p>USGS SIM 3464 — Sun &amp; Stack (2020), escala 1:75.000. Interpretación publicada con desfase documentado de 100–200 m frente al CTX de operaciones; excluida de los costes y barreras de A*. M1–M3 son selecciones del equipo, no estaciones oficiales.</p><p>Fotografías Navcam: NASA/JPL-Caltech. Posición del rover comprobada por sol y RMC con waypoints oficiales; no localización de los blancos fotografiados. Mars Trek se consultó para evaluar cobertura y productos complementarios; no se incorporan sus rásteres.</p><a className="science-reference" href="https://doi.org/10.3133/sim3464" target="_blank" rel="noreferrer">USGS SIM 3464 ↗</a><a className="science-reference" href="/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Créditos y licencias de materiales y software ↗</a></div>
      <div className="dialog-footer"><Info size={15} /><p>Datos orbitales, interpretación geológica y registros del rover, con sus incertidumbres. Reproyección, objetivos y rutas derivados por The Meowrtian; sin aval operativo NASA/USGS.</p></div>
    </dialog>
  </div>;
}

function EndpointButton({ kind, endpoint, active, grid, onClick }: { kind: 'start' | 'goal'; endpoint: Endpoint | null; active: boolean; grid: RoutingGrid | null; onClick: () => void }) {
  const coordinates = endpoint && grid ? marsLonLat(grid, endpoint.center) : null;
  return <button className={`endpoint-button ${active ? 'active' : ''} ${endpoint ? 'has-point' : ''}`} onClick={onClick} aria-label={kind === 'start' ? 'Seleccionar origen' : 'Seleccionar destino'} aria-pressed={active}>
    <span className={`endpoint-icon ${kind}`}>{kind === 'start' ? <Crosshair size={18} /> : <Flag size={17} />}</span><span className="endpoint-copy"><strong>{kind === 'start' ? 'Punto de partida' : 'Destino'}</strong>
      {endpoint && coordinates ? <><span className="endpoint-coordinates">{coordinates.latitudeNorthDeg.toFixed(5)}° N · {coordinates.longitudeEastDeg.toFixed(5)}° E</span><small>Celda {endpoint.cell.col}, {endpoint.cell.row} · ajuste {number(endpoint.snapMeters)} m</small></> : <span>Haz clic sobre el mapa</span>}</span>{endpoint ? <Check className="endpoint-check" size={13} /> : <span className="endpoint-index">{kind === 'start' ? '1' : '2'}</span>}
  </button>;
}
function routeFailure(result: RouteResult): string {
  if (result.status === 'no-route') return 'No existe una ruta entre estos extremos bajo las restricciones actuales. Prueba otra selección o revisa el límite de pendiente.';
  if (result.status === 'invalid-start' || result.status === 'invalid-goal') return 'Un extremo no cumple las restricciones. Selecciona otra celda; no se ha movido automáticamente.';
  return 'No se pudo completar el cálculo. Revisa los parámetros y vuelve a intentarlo.';
}
