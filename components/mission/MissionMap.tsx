'use client';
import { useEffect, useRef, useState } from 'react';
import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import Projection from 'ol/proj/Projection.js';
import ImageLayer from 'ol/layer/Image.js';
import VectorLayer from 'ol/layer/Vector.js';
import Static from 'ol/source/ImageStatic.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import Overlay from 'ol/Overlay.js';
import { defaults as interactions } from 'ol/interaction/defaults.js';
import ScaleLine from 'ol/control/ScaleLine.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import CircleStyle from 'ol/style/Circle.js';
import Text from 'ol/style/Text.js';
import { Info, Minus, Navigation2, Plus, Scan } from 'lucide-react';
import { DATA_URL, marsLonLat, ROUTE_COLORS, routeCoordinates } from '../../lib/map/model';
import type { Endpoint, LayerId, VisualCatalog, MapExtent } from '../../lib/map/model';
import type { RoutingGrid, RouteSuccess, XY } from '../../lib/routing/types';
import { UNIT_COLORS } from '../../lib/science/model';
import type { ScienceData, ScienceObjective, ScienceSelection } from '../../lib/science/model';
import { ScienceInspector } from './SciencePanel';
import RegionalOverview from './RegionalOverview';
import { LAYER_COPY } from '../../lib/map/display-copy';

export interface MissionMapProps {
  grid: RoutingGrid; catalog: VisualCatalog; activeLayer: LayerId;
  selectionMode: 'start' | 'goal' | null; origin: Endpoint | null; destination: Endpoint | null;
  routes: { a: RouteSuccess | null; b: RouteSuccess | null };
  visibility: { a: boolean; b: boolean }; showNoData: boolean;
  onPick: (xy: XY) => void; onReady: () => void; onError: (message: string) => void;
  onSources: () => void;
  science: ScienceData | null; showGeology: boolean; showObjectives: boolean; showPhotos: boolean; geologyOpacity: number;
  scienceSelection: ScienceSelection; onScienceSelect: (selection: ScienceSelection) => void;
  onAssignObjective: (objective: ScienceObjective, kind: 'start' | 'goal') => void;
  focusVersion?: number;
}
export default function MissionMap(props: MissionMapProps) {
  const target = useRef<HTMLDivElement>(null), map = useRef<OlMap | null>(null);
  const current = useRef(props); current.current = props;
  const rasters = useRef<Partial<Record<LayerId, ImageLayer<Static>>>>({});
  const noData = useRef<ImageLayer<Static> | null>(null);
  const vector = useRef<Record<'a' | 'b', VectorLayer<VectorSource<Feature<LineString>>>> | null>(null);
  const markers = useRef<{ start: Overlay; goal: Overlay } | null>(null);
  const geologyLayer = useRef<VectorLayer<VectorSource> | null>(null), sciencePoints = useRef<VectorLayer<VectorSource> | null>(null);
  const [viewState, setViewState] = useState({ x: 0, y: 0, resolution: 1, extent: props.catalog.extent });
  const [pointer, setPointer] = useState<XY | null>(null);
  const [ready, setReady] = useState(false);
  const [compact, setCompact] = useState(false);
  const { grid, catalog } = props;
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setCompact(media.matches); update();
    media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!target.current) return;
    const extent = catalog.extent;
    const projection = new Projection({ code: 'MARS:JEZERO_LOCAL', units: 'm', extent: [...extent], global: false,
      getPointResolution: resolution => resolution });
    const layers = catalog.layers.map(layer => {
      const source = new Static({ url: DATA_URL + layer.file, projection, imageExtent: [...layer.extent], interpolate: layer.id !== 'slope' });
      source.on('imageloaderror', () => current.current.onError(`Could not load the ${LAYER_COPY[layer.id].title} layer.`));
      const raster = new ImageLayer({ source, visible: layer.id === current.current.activeLayer });
      rasters.current[layer.id] = raster;
      return raster;
    });
    const mask = new ImageLayer({ source: new Static({ url: DATA_URL + catalog.noData.file, projection,
      imageExtent: [...catalog.noData.extent], interpolate: false }), visible: current.current.showNoData, extent: [...extent] });
    noData.current = mask;
    const gridFeatures: Feature<LineString>[] = [];
    for (let x = Math.ceil(extent[0] / 500) * 500; x < extent[2]; x += 500) gridFeatures.push(new Feature(new LineString([[x, extent[1]], [x, extent[3]]])));
    for (let y = Math.ceil(extent[1] / 500) * 500; y < extent[3]; y += 500) gridFeatures.push(new Feature(new LineString([[extent[0], y], [extent[2], y]])));
    const graticule = new VectorLayer({ source: new VectorSource({ features: gridFeatures, wrapX: false }),
      style: new Style({ stroke: new Stroke({ color: 'rgba(255,255,255,.13)', width: .7, lineDash: [2, 7] }) }) });
    const makeRouteLayer = (id: 'a' | 'b') => new VectorLayer({ source: new VectorSource<Feature<LineString>>({ wrapX: false }),
      style: [new Style({ stroke: new Stroke({ color: 'rgba(5,10,14,.75)', width: 6 }) }),
        new Style({ stroke: new Stroke({ color: ROUTE_COLORS[id], width: 3, ...(id === 'b' ? { lineDash: [9, 5] } : {}) }) })] });
    const a = makeRouteLayer('a'), b = makeRouteLayer('b'); vector.current = { a, b };
    const geology = new VectorLayer({ source: new VectorSource({ wrapX: false }), visible: current.current.showGeology, opacity: current.current.geologyOpacity,
      style: feature => new Style({ fill: new Fill({ color: UNIT_COLORS[String(feature.get('symbol'))] ?? '#aaa' }),
        stroke: new Stroke({ color: '#f5edf0', width: current.current.scienceSelection?.kind === 'unit' && current.current.scienceSelection.id === feature.getId() ? 3 : 1.4, lineDash: [6, 4] }) }) });
    geologyLayer.current = geology;
    const points = new VectorLayer({ source: new VectorSource({ wrapX: false }),
      style: feature => { const color = feature.get('kind') === 'photo' ? '#c8dce6' : '#c8e29c';
        return new Style({ image: new CircleStyle({ radius: feature.get('kind') === 'photo' ? 5 : 7, fill: new Fill({ color: '#111d22' }), stroke: new Stroke({ color, width: 2 }) }),
          text: new Text({ text: String(feature.get('label')), font: 'bold 11px sans-serif', offsetX: 17, offsetY: -7, fill: new Fill({ color }), stroke: new Stroke({ color: '#10171e', width: 4 }) }) }); } });
    sciencePoints.current = points;
    const view = new View({ projection, center: [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2], resolution: 8,
      minResolution: .75, maxResolution: 24, extent: [extent[0] - 400, extent[1] - 400, extent[2] + 400, extent[3] + 400], constrainOnlyCenter: true });
    const instance = new OlMap({ target: target.current, view, layers: [...layers, geology, graticule, mask, a, b, points],
      controls: [new ScaleLine({ units: 'metric', minWidth: 90, className: 'mars-scale' })],
      interactions: interactions({ altShiftDragRotate: false, pinchRotate: false }) });
    map.current = instance;
    const makeMarker = (kind: 'start' | 'goal') => {
      const element = document.createElement('div'); element.className = `map-marker ${kind}`;
      element.setAttribute('role', 'img'); element.setAttribute('aria-label', kind === 'start' ? 'Origin marker' : 'Destination marker');
      element.innerHTML = `<span class="marker-number">${kind === 'start' ? '1' : '2'}</span><span class="marker-label">${kind === 'start' ? 'ORIGIN' : 'DESTINATION'}</span>`;
      const overlay = new Overlay({ element, positioning: 'center-center', stopEvent: false });
      instance.addOverlay(overlay); return overlay;
    };
    markers.current = { start: makeMarker('start'), goal: makeMarker('goal') };
    const update = () => { const centre = view.getCenter()!; setViewState({ x: centre[0]!, y: centre[1]!, resolution: view.getResolution()!, extent: view.calculateExtent(instance.getSize()) as MapExtent }); };
    instance.on('moveend', update);
    instance.on('singleclick', event => {
      const selection = instance.forEachFeatureAtPixel(event.pixel, feature => {
        const kind = feature.get('kind');
        if (kind === 'objective' || kind === 'photo') return { kind, id: String(feature.get('scienceId')) } as ScienceSelection;
        if (kind === 'unit' && !current.current.selectionMode) return { kind, id: Number(feature.getId()) } as ScienceSelection;
        return undefined;
      }, { hitTolerance: 4 });
      if (selection) current.current.onScienceSelect(selection);
      else current.current.onPick({ x: event.coordinate[0]!, y: event.coordinate[1]! });
    });
    instance.on('pointermove', event => { if (!event.dragging) setPointer({ x: event.coordinate[0]!, y: event.coordinate[1]! }); });
    instance.once('rendercomplete', () => { setReady(true); current.current.onReady(); });
    instance.updateSize(); view.fit([...extent], { padding: [24, 30, 30, 30], duration: 0 }); update();
    const resize = new ResizeObserver(() => { instance.updateSize(); update(); }); resize.observe(target.current);
    return () => { resize.disconnect(); instance.setTarget(undefined); instance.dispose(); map.current = null; };
  }, [grid, catalog]);
  useEffect(() => {
    if (props.focusVersion) map.current?.getView().fit([...catalog.extent], { padding: [24, 30, 30, 30], duration: 0 });
  }, [props.focusVersion, catalog]);
  useEffect(() => { for (const id of ['ortho', 'hillshade', 'elevation', 'slope'] as const) rasters.current[id]?.setVisible(props.activeLayer === id); }, [props.activeLayer]);
  useEffect(() => { noData.current?.setVisible(props.showNoData); }, [props.showNoData]);
  useEffect(() => {
    const layer = geologyLayer.current; if (!layer) return;
    layer.getSource()!.clear();
    if (props.science) {
      // Custom local-Mars JSON: both projections explicit; never use GeoJSON's Earth default.
      const projection = map.current!.getView().getProjection();
      const features = new GeoJSON().readFeatures({ type: 'FeatureCollection', features: props.science.geology.features }, { dataProjection: projection, featureProjection: projection });
      for (const feature of features) feature.set('kind', 'unit');
      layer.getSource()!.addFeatures(features);
    }
  }, [props.science, ready]);
  useEffect(() => { geologyLayer.current?.setVisible(props.showGeology); geologyLayer.current?.setOpacity(props.geologyOpacity); }, [props.showGeology, props.geologyOpacity]);
  useEffect(() => {
    const source = sciencePoints.current?.getSource(); if (!source) return; source.clear();
    if (props.showObjectives) props.science?.objectives.forEach((point, i) => source.addFeature(new Feature({ geometry: new Point([...point.xy]), kind: 'objective', scienceId: point.id, label: `M${i + 1}` })));
    if (props.showPhotos) props.science?.photos.forEach((point, i) => source.addFeature(new Feature({ geometry: new Point([...point.xy]), kind: 'photo', scienceId: point.id, label: `R${i + 1}` })));
  }, [props.science, props.showObjectives, props.showPhotos, ready]);
  useEffect(() => { geologyLayer.current?.changed(); }, [props.scienceSelection]);
  useEffect(() => {
    markers.current?.start.setPosition(props.origin ? [props.origin.center.x, props.origin.center.y] : undefined);
    markers.current?.goal.setPosition(props.destination ? [props.destination.center.x, props.destination.center.y] : undefined);
  }, [props.origin, props.destination, ready]);
  useEffect(() => {
    for (const id of ['a', 'b'] as const) {
      const layer = vector.current?.[id]; if (!layer) continue;
      layer.getSource()!.clear(); const result = props.routes[id];
      if (result) layer.getSource()!.addFeature(new Feature(new LineString(routeCoordinates(grid, result).map(p => [p[0], p[1]]))));
      layer.setVisible(props.visibility[id]);
    }
  }, [grid, props.routes, props.visibility, ready]);
  const layer = catalog.layers.find(x => x.id === props.activeLayer)!;
  const coord = marsLonLat(grid, pointer ?? { x: viewState.x, y: viewState.y });
  return <div className={`map-shell ${props.selectionMode ? 'selecting' : ''}`}>
    <div ref={target} className="mars-map" data-testid="mars-map" data-map-ready={ready} data-center-x={viewState.x} data-center-y={viewState.y}
      data-geology-features={props.showGeology ? props.science?.geology.features.length ?? 0 : 0} data-science-points={(props.showObjectives ? props.science?.objectives.length ?? 0 : 0) + (props.showPhotos ? props.science?.photos.length ?? 0 : 0)}
      data-resolution={viewState.resolution} data-route-a-nodes={props.routes.a?.cells.length ?? 0} data-route-b-nodes={props.routes.b?.cells.length ?? 0}
      data-origin-cell={props.origin ? JSON.stringify(props.origin.cell) : ''} data-destination-cell={props.destination ? JSON.stringify(props.destination.cell) : ''}
      aria-label="Interactive Jezero map, local Martian coordinates" />
    <div className="map-label"><span className="eyebrow">MRO / HIRISE</span><strong>JEZERO CRATER</strong><span>Western sector · Mars</span></div>
    <RegionalOverview grid={grid} studyExtent={catalog.extent} viewport={viewState.extent} onRecenter={() => map.current?.getView().fit([...catalog.extent], { padding: [24, 30, 30, 30], duration: 0 })} />
    <div className="map-tools"><span className="north-marker" aria-label="North up"><Navigation2 size={17} fill="currentColor" /><b>N</b></span>
      <div className="zoom-buttons"><button title="Zoom in" aria-label="Zoom in map" onClick={() => map.current?.getView().adjustZoom(1)}><Plus size={17} /></button><button title="Zoom out" aria-label="Zoom out map" onClick={() => map.current?.getView().adjustZoom(-1)}><Minus size={17} /></button></div>
      <button className="map-tool" title="Fit study area" aria-label="Fit study area" onClick={() => map.current?.getView().fit([...catalog.extent], { padding: [24, 30, 30, 30], duration: 0 })}><Scan size={17} /></button>
    </div>
    {props.selectionMode && <div className="selection-hint"><span className="hint-dot" />Click to choose {props.selectionMode === 'start' ? 'the origin' : 'the destination'}</div>}
    {props.showGeology && <div className="geology-map-note">USGS SIM 3464 · documented offset ~100–200 m · context</div>}
    {props.showGeology && props.science && <details className="geology-map-key" open={!compact}><summary>USGS units · SIM 3464</summary>{[...new Map(props.science.geology.features.map(f => [f.properties.symbol, f])).values()].map(f => <button key={f.properties.symbol} onClick={() => props.onScienceSelect({ kind: 'unit', id: f.id })}><i style={{ background: UNIT_COLORS[f.properties.symbol] }} /><b>{f.properties.symbol}</b><span>{f.properties.name}</span></button>)}<small>Team colors · approximate contacts</small></details>}
    {props.science && <ScienceInspector science={props.science} selection={props.scienceSelection} onClose={() => props.onScienceSelect(null)} onAssign={props.onAssignObjective} />}
    <div className="map-legend">
      <button className="layer-caption" onClick={props.onSources}><span>{LAYER_COPY[layer.id].title}</span><Info size={12} /><small>{layer.displayResolutionM} m visual</small></button>
      {layer.colors && <><div className="color-ramp" style={{ background: `linear-gradient(90deg,${layer.colors.join(',')})` }} /><div className="ramp-labels"><span>{layer.minimum?.toFixed(0)} {layer.units === 'm' ? 'm' : '°'}</span><span>{layer.maximum?.toFixed(0)}{props.activeLayer === 'slope' ? '°+' : ' m'}</span></div></>}
      {props.showNoData && <span className="mask-key"><i />No valid data · 10 m grid</span>}
    </div>
    <div className="map-bottom"><span className="coordinate-readout" data-testid="map-coordinates">{coord.latitudeNorthDeg.toFixed(5)}° N <i />{coord.longitudeEastDeg.toFixed(5)}° E</span><span>500 m grid · local Martian CRS</span></div>
    {!ready && <div className="map-loading"><span className="loading-ring" /><p>Loading real orbital imagery</p></div>}
  </div>;
}
