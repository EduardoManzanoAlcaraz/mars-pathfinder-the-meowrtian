import type { ScienceObjective } from './model.js';
// English presentation of existing team intents; not official feature names,
// new observations, mineral identifications or changes to the source records.
const stories: Record<string, { name: string; question: string }> = {
  'meowrtian-nhjf2': {
    name: 'Fan deposits',
    question: 'Compare textures, relief and possible layered exposures with the crater floor. Test the deltaic context interpreted in SIM 3464. Layering at this cell requires field observation.',
  },
  'meowrtian-nle': {
    name: 'Eroded terrain',
    question: 'Document the morphology and erosion of the Lower etched unit. Compare the published alternative depositional interpretations without assuming a mineral composition at this point.',
  },
  'meowrtian-njf': {
    name: 'Crater floor',
    question: 'Characterize the mapped floor’s texture, cratering and relief, then compare them with the fan and Lower etched unit. This point is not an identified Perseverance sample or station.',
  },
};
export function objectiveStory(objective: ScienceObjective) {
  return stories[objective.id] ?? { name: objective.label.split(' · ')[1] ?? objective.label, question: objective.scientificObjective };
}
