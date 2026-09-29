// Further reading: the English Wikipedia article behind each label, keyed by the
// label's name (names change with the stage, e.g. a process becomes a pseudopod).
// Titles checked against the Wikipedia API; where a structure has no article of
// its own it points to the closest topic.

const ARTICLES: Record<string, string> = {
  // shared
  'Nucleus': 'Cell nucleus',
  'Nucleolus': 'Nucleolus',
  'Mitochondria': 'Mitochondria',
  // yeast
  'Vacuole': 'Vacuole',
  'Cell wall': 'Cell wall',
  'Bud scar': 'Budding',
  'Septin ring': 'Septin',
  'Bud (daughter)': 'Budding',
  'Anaphase bridge': 'Anaphase',
  'Daughter nucleus': 'Mitosis',
  // red blood cell
  'Membrane skeleton': 'Spectrin',
  'Haemoglobin': 'Hemoglobin',
  'Central dimple': 'Red blood cell',
  'Rim': 'Red blood cell',
  'Crenation': 'Crenation',
  'Spicule': 'Echinocyte',
  'Spherical shape': 'Spherocytosis',
  // fibroblast
  'Nascent adhesion': 'Focal adhesion',
  'Focal adhesion': 'Focal adhesion',
  'Stress fibre': 'Stress fiber',
  'Radial fibre': 'Stress fiber',
  'α-SMA stress fibre': 'Myofibroblast',
  'Spreading skirt': 'Cell adhesion',
  'Spreading edge': 'Lamellipodium',
  'Lamellipodium': 'Lamellipodium',
  'Trailing edge': 'Cell migration',
  // microglia
  'Phagolysosome': 'Phagolysosome',
  'Ramified process': 'Microglia',
  'Retracting process': 'Microglia',
  'Pseudopod': 'Pseudopodia',
  'Process tip': 'P2Y12',
  // neuron
  'Nissl body': 'Nissl body',
  'Axon hillock': 'Axon hillock',
  'Dendrite': 'Dendrite',
  'Axon': 'Axon',
  'Axon terminal': 'Axon terminal',
  'Axon stump': 'Axotomy',
  'Retraction bulb': 'Neuroregeneration',
  'Growth cone': 'Growth cone',
};

/** The Wikipedia link for a label name, or undefined if it has none. */
export function wikiUrl(name: string): string | undefined {
  const title = ARTICLES[name];
  return title && `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}
