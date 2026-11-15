import type { Metadata } from 'next';
import './globals.css';
import 'ol/ol.css';

export const metadata: Metadata = {
  title: 'Mars Pathfinder · The Meowrtian',
  description: 'Planificador topográfico de rutas en Jezero con datos reales HiRISE. NASA Space Apps Challenge 2026 · The Meowrtian.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
