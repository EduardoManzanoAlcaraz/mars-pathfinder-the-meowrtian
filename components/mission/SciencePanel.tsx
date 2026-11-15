'use client';
import { BookOpen, Camera, ChevronRight, Flag, Layers, X } from 'lucide-react';
import { SCIENCE_URL, UNIT_COLORS } from '../../lib/science/model';
import type { ScienceData, ScienceObjective, ScienceSelection } from '../../lib/science/model';
import { objectiveStory } from '../../lib/science/objective-story';

interface ControlsProps { science: ScienceData | null; error: string; showGeology: boolean; showObjectives: boolean; showPhotos: boolean; opacity: number;
  onGeology: (show: boolean) => void; onObjectives: (show: boolean) => void; onPhotos: (show: boolean) => void; onOpacity: (opacity: number) => void; onSelect: (selection: ScienceSelection) => void }
export function ScienceControls(p: ControlsProps) {
  const units = p.science ? [...new Map(p.science.geology.features.map(f => [f.properties.symbol, f.properties])).values()] : [];
  return <section className="control-section science-controls" data-testid="science-controls" data-science-ready={!!p.science}>
    <div className="section-heading"><span>04</span><h2>Contexto científico</h2><BookOpen size={14} /></div>
    {!p.science ? <p className="parameter-note" role={p.error ? 'alert' : 'status'}>{p.error || 'Verificando geología y registros NASA…'}</p> : <>
      <label className="science-toggle"><input type="checkbox" checked={p.showGeology} onChange={e => p.onGeology(e.target.checked)} /><Layers size={14} />Geología USGS SIM 3464</label>
      <p className="science-warning">Escala 1:75.000 · desfase 100–200 m.<br />Contexto interpretativo; no afecta a A*.</p>
      {p.showGeology && <>
        <label className="science-opacity">Opacidad <input aria-label="Opacidad de geología" type="range" min="0.1" max="0.65" step="0.05" value={p.opacity} onChange={e => p.onOpacity(Number(e.target.value))} /></label>
        <div className="geology-key" aria-label="Leyenda geológica">{units.map(unit => <button key={unit.symbol} onClick={() => p.onSelect({ kind: 'unit', id: p.science!.geology.features.find(f => f.properties.symbol === unit.symbol)!.id })} title={unit.name}><i style={{ background: UNIT_COLORS[unit.symbol] }} /><b>{unit.symbol}</b><span>{unit.name}</span></button>)}<small>Colores de visualización: The Meowrtian</small></div>
      </>}
      <label className="science-toggle"><input type="checkbox" checked={p.showObjectives} onChange={e => p.onObjectives(e.target.checked)} /><Flag size={14} />Objetivos del equipo</label>
      <p className="science-selection-note">Team-selected science objectives<br />Not official NASA/USGS stations.</p>
      <div className="science-objectives">{p.science.objectives.map((o, i) => <button key={o.id} onClick={() => p.onSelect({ kind: 'objective', id: o.id })} aria-label={`Consultar objetivo M${i + 1}`}><b>M{i + 1}</b><span>{objectiveStory(o).name}<small>{o.unitSymbol} · {o.unitName}</small></span><ChevronRight size={12} /></button>)}</div>
      <label className="science-toggle"><input type="checkbox" checked={p.showPhotos} onChange={e => p.onPhotos(e.target.checked)} /><Camera size={14} />Fotografías Perseverance</label>
      {p.showPhotos && <div className="science-photo-links">{p.science.photos.map(photo => <button key={photo.id} onClick={() => p.onSelect({ kind: 'photo', id: photo.id })}>{photo.label}<span>RMC {photo.rmc} <ChevronRight size={11} /></span></button>)}</div>}
    </>}
  </section>;
}

export function ScienceInspector({ science, selection, onClose, onAssign }: { science: ScienceData; selection: ScienceSelection; onClose: () => void; onAssign: (objective: ScienceObjective, kind: 'start' | 'goal') => void }) {
  if (!selection) return null;
  const objective = selection.kind === 'objective' ? science.objectives.find(o => o.id === selection.id) : null;
  const photo = selection.kind === 'photo' ? science.photos.find(o => o.id === selection.id) : null;
  const feature = selection.kind === 'unit' ? science.geology.features.find(f => f.id === selection.id) : objective ? science.geology.features.find(f => f.id === objective.sourceFid) : null;
  return <aside className="science-inspector" aria-label="Ficha científica" data-testid="science-inspector" data-selection-kind={selection.kind}>
    <div className="science-inspector-heading"><span className="eyebrow">{photo ? 'REGISTRO DOCUMENTADO NASA' : objective ? 'TEAM-SELECTED SCIENCE OBJECTIVE' : 'INTERPRETACIÓN PUBLICADA · USGS'}</span><button aria-label="Cerrar ficha científica" onClick={onClose}><X size={16} /></button></div>
    <div className="science-inspector-body" tabIndex={0} aria-label="Contenido de la ficha; desplázate para leer las referencias">
    <h3>{objective ? `${objective.label.split(' · ')[0]} · ${objectiveStory(objective).name}` : photo?.label ?? feature?.properties.name}</h3>
    {feature && <><div className="science-unit-label"><i style={{ background: UNIT_COLORS[feature.properties.symbol] }} /><b>{feature.properties.symbol}</b><span>{feature.properties.name}</span></div><p className="science-citation">Sun &amp; Stack, 2020 · SIM 3464 · 1:75.000<br />GeoUnits_v1 · OBJECTID {feature.id}</p></>}
    {objective && <>
      <p className="science-citation">Original team record: {objective.label}</p>
      <div className="science-question" lang="en"><h4>Scientific objective</h4><p>{objectiveStory(objective).question}</p></div>
      <div className="science-coordinates">{objective.latitudePlanetocentricDeg.toFixed(6)}° N · {objective.longitudeEastDeg.toFixed(6)}° E<br />x {objective.xy[0]} m · y {objective.xy[1]} m</div>
      <p className="science-citation">Centro de celda válido · {objective.elevationMeters.toFixed(1)} m de altura<br />Pendiente máxima de celda: {objective.routingSlopeMaxDeg.toFixed(2)}°</p>
      <p className="science-warning">{objective.designation}. La precisión numérica no equivale a exactitud de ubicación.</p>
      <p className="science-uncertainty"><b>Location uncertainty</b><br />10 m grid cell ≠ location accuracy.<br />Geological registration offset: 100–200 m.</p>
      <a className="science-reference" href={objective.sources[0]!.url} target="_blank" rel="noreferrer">Source: Sun &amp; Stack (2020), USGS ↗</a>
      <details><summary>Fuentes del objetivo</summary>{objective.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>)}<p>{objective.scientificObjective}</p></details>
    </>}
    {photo && <>
      <a href={photo.sourcePageUrl} target="_blank" rel="noreferrer" title="Abrir fotografía y registro NASA"><img src={SCIENCE_URL + photo.file} width="800" height="600" alt={`${photo.instrument}, Perseverance sol ${photo.sol}; imagen auténtica NASA`} loading="lazy" /></a>
      <p className="photo-credit">{photo.credit}</p>
      <p className="science-citation"><time dateTime={photo.utc}>{new Date(photo.utc).toLocaleString('es-ES', { timeZone: 'UTC' })} UTC</time><br />{photo.instrument} · RMC {photo.rmc}</p>
      <div className="science-coordinates">{photo.latitudePlanetocentricDeg.toFixed(6)}° N · {photo.longitudeEastDeg.toFixed(6)}° E</div>
      <p>{photo.locationMeaningEs}</p><p className="science-warning">{photo.uncertainty.noteEs}</p>
      <details><summary>Verificación documental</summary><p>Coinciden el sol, sitio y drive del registro de imagen y un waypoint oficial único.</p><code>{photo.imageId}</code><a href={photo.metadataUrl} target="_blank" rel="noreferrer">Metadatos de la imagen NASA ↗</a><a href={photo.waypointSourceUrl} target="_blank" rel="noreferrer">Waypoints oficiales ↗</a></details>
    </>}
    {feature && <><p className="science-warning">{science.geology.registration.warningEs}</p>{!objective && <a className="science-reference" href="https://doi.org/10.3133/sim3464" target="_blank" rel="noreferrer">Publicación y base oficial USGS ↗</a>}</>}
    </div>
    <div className="science-inspector-footer">
      <p>{photo ? 'Marca: posición documentada del rover, no de los blancos.' : 'USGS · desfase 100–200 m. Contexto sin efecto sobre A*.'}</p>
      {objective && <div className="science-assign"><button onClick={() => onAssign(objective, 'start')}>Usar como origen</button><button onClick={() => onAssign(objective, 'goal')}>Usar como destino</button></div>}
    </div>
  </aside>;
}
