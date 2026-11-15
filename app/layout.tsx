import type { Metadata } from 'next';
import './globals.css';
import 'ol/ol.css';

export const metadata: Metadata = {
  title: 'Mars Pathfinder · The Meowrtian',
  description: 'Topographic route planning in Jezero with real HiRISE data. NASA Space Apps Challenge 2026 · The Meowrtian.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
