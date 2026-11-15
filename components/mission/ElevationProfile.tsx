'use client';
import { useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { elevationProfile, ROUTE_COLORS } from '../../lib/map/model';
import type { RoutingGrid, RouteSuccess } from '../../lib/routing/types';

export default function ElevationProfile({ grid, route, selected }: { grid: RoutingGrid; route: RouteSuccess | null; selected: 'a' | 'b' }) {
  const data = useMemo(() => route ? elevationProfile(grid, route) : [], [grid, route]);
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return <div className="profile-empty"><Activity size={25} strokeWidth={1.3} /><span>El relieve de tu recorrido</span><p>Calcula las rutas para consultar el perfil.</p></div>;
  const width = 460, height = 236, left = 53, right = 18, top = 24, bottom = 39;
  const length = data.at(-1)!.distanceMeters;
  let min = Math.floor(Math.min(...data.map(p => p.elevationMeters)) / 5) * 5;
  let max = Math.ceil(Math.max(...data.map(p => p.elevationMeters)) / 5) * 5;
  if (min === max) { min -= 1; max += 1; }
  const x = (v: number) => left + v / (length || 1) * (width - left - right);
  const y = (v: number) => top + (max - v) / (max - min) * (height - top - bottom);
  const line = data.map((p, i) => `${i ? 'L' : 'M'}${x(p.distanceMeters).toFixed(2)},${y(p.elevationMeters).toFixed(2)}`).join(' ');
  const color = ROUTE_COLORS[selected], point = hover !== null ? data[hover] : null;
  return <div className="profile-chart" data-testid="elevation-profile" data-profile-distance={length} data-profile-points={data.length}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Perfil de elevación de la ruta ${selected.toUpperCase()}, distancia horizontal en metros y altura sobre equipotencial marciana en metros`}
      onPointerLeave={() => setHover(null)} onPointerMove={event => {
        const bounds = event.currentTarget.getBoundingClientRect(), value = Math.max(0, Math.min(length, ((event.clientX - bounds.left) / bounds.width * width - left) / (width - left - right) * length));
        let best = 0; for (let i = 1; i < data.length; i++) if (Math.abs(data[i]!.distanceMeters - value) < Math.abs(data[best]!.distanceMeters - value)) best = i;
        setHover(best);
      }}>
      <defs><linearGradient id={`profile-fill-${selected}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".2" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[min, (min + max) / 2, max].map(value => <g key={value}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="profile-grid" /><text x={left - 8} y={y(value) + 3} textAnchor="end">{Math.round(value)}</text></g>)}
      {[0, length / 2, length].map((value, i) => <text key={i} x={x(value)} y={height - 16} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{Math.round(value).toLocaleString('es-ES')}</text>)}
      <path d={`${line} L${x(length)},${height - bottom} L${left},${height - bottom} Z`} fill={`url(#profile-fill-${selected})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {data.length === 1 && <circle cx={left} cy={y(data[0]!.elevationMeters)} r="3" fill={color} />}
      {point && <g><line x1={x(point.distanceMeters)} x2={x(point.distanceMeters)} y1={top} y2={height - bottom} stroke={color} strokeDasharray="3 3" opacity=".5" /><circle cx={x(point.distanceMeters)} cy={y(point.elevationMeters)} r="3" fill={color} /></g>}
      <text x={left} y="9" className="axis-unit">ALTURA (m)</text><text x={width - right} y={height - 1} textAnchor="end" className="axis-unit">DISTANCIA HORIZONTAL (m)</text>
    </svg>
    <div className="profile-caption"><span>{point ? `${point.distanceMeters.toFixed(0)} m · ${point.elevationMeters.toFixed(1)} m de altura` : 'Alturas del DEM medio de 10 m'}</span><span>Marte · equipotencial</span></div>
    <p className="profile-model-note">Vertical scale is fitted to this route. Compare numerical ascent and slope; apparent steepness is exaggerated.</p>
  </div>;
}
