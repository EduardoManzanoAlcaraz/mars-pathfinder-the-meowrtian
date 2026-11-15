import type { LayerId } from './model';

// Presentation only. Prepared manifests, scientific records and their hashes stay unchanged.
export const LAYER_COPY: Record<LayerId, { title: string; provenance: string }> = {
  ortho: { title: 'Orthoimage', provenance: 'Real · processed orbital image' },
  hillshade: { title: 'Hillshade', provenance: 'Derived · The Meowrtian' },
  elevation: { title: 'Elevation', provenance: 'Real · stereo DEM / derived visualization' },
  slope: { title: 'Slope', provenance: 'Derived · The Meowrtian' },
};

const scienceText: Readonly<Record<string, string>> = {
  'Objetivo propuesto por The Meowrtian; no es nombre ni estación oficial NASA/USGS': 'Objective proposed by The Meowrtian; not an official NASA/USGS name or station',
  'Comparar textura, relieve y posibles exposiciones estratificadas de la unidad cartografiada con el suelo del cráter; evaluar su contexto de depósito deltaico interpretado en SIM 3464. La estratificación en este punto requiere observación de campo.': 'Compare the texture, relief and possible layered exposures of the mapped unit with the crater floor; assess its deltaic depositional context as interpreted in SIM 3464. Layering at this point requires field observation.',
  'Documentar morfología y relaciones de erosión de la unidad Nle; contrastar con las interpretaciones deposicionales alternativas publicadas, sin asumir composición mineral en este punto.': 'Document the morphology and erosion relationships of the Nle unit; compare the published alternative depositional interpretations, without assuming a mineral composition at this point.',
  'Caracterizar textura, craterización y relieve del suelo cartografiado y compararlos con el abanico y la unidad Nle. No se identifica aquí una muestra ni una estación de Perseverance.': 'Characterize the texture, cratering and relief of the mapped floor and compare them with the fan and Nle unit. No Perseverance sample or station is identified here.',
  'Sun & Stack (2020), USGS SIM 3464, GeoUnits_v1 y descripción de unidades': 'Sun & Stack (2020), USGS SIM 3464, GeoUnits_v1 and unit descriptions',
  'HiRISE: DTM ESP_045994_1985 / ESP_046060_1985 y orto RED_C': 'HiRISE: DTM ESP_045994_1985 / ESP_046060_1985 and RED_C orthoimage',
  'Posición documentada del rover al adquirir la imagen; no es la posición del terreno fotografiado. El centro óptico está desplazado respecto al rover. No se deduce la ubicación de rocas visibles.': 'Documented rover position when the image was acquired; not the location of the photographed terrain. The optical center is offset from the rover. The locations of visible rocks are not inferred.',
  'El servicio de waypoints no proporciona exactitud absoluta por punto. Se conserva su posición documentada, sin asignar una precisión métrica inventada ni asociar la imagen a un blanco geológico.': 'The waypoint service does not provide per-point absolute accuracy. Its documented position is retained without assigning invented metric precision or associating the image with a geological target.',
  'SIM 3464: desfases documentados de 100–200 m frente al CTX de operaciones. Reproyectar no los corrige. Contactos orientativos, sin efecto sobre A*.': 'SIM 3464: documented 100–200 m offsets against the operations CTX mosaic. Reprojection does not correct them. Contacts are approximate and have no effect on A*.',
};
export function englishScienceText(original: string): string {
  return scienceText[original] ?? original;
}
