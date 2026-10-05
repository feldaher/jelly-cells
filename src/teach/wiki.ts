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
  'Spindle': 'Spindle apparatus',
  'Contractile ring': 'Actomyosin ring',
  'Septum': 'Septum (cell biology)',
  // fission yeast
  'Vacuoles': 'Vacuole',
  'Birth scar': 'Schizosaccharomyces pombe',
  'Microtubule bundle': 'Microtubule',
  'Old end': 'Cell polarity',
  'New end': 'Cell polarity',
  'New cell ends': 'Fission (biology)',
  // E. coli
  'Nucleoid': 'Nucleoid',
  'Cell envelope': 'Cell envelope',
  'Ribosome-rich cytoplasm': 'Ribosome',
  'Chemoreceptor array': 'Chemotaxis',
  'Cell pole': 'Flagellum',
  'Z ring': 'FtsZ',
  'Constriction': 'Divisome',
  'New poles': 'Fission (biology)',
  // red blood cell
  'Membrane skeleton': 'Spectrin',
  'Haemoglobin': 'Hemoglobin',
  'Central dimple': 'Red blood cell',
  'Rim': 'Red blood cell',
  'Crenation': 'Crenation',
  'Spicule': 'Echinocyte',
  'Spherical shape': 'Spherocytosis',
  // fibroblast
  'Golgi apparatus': 'Golgi apparatus',
  'Centrosome': 'Centrosome',
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
  // animal and plant cell
  'Rough ER': 'Endoplasmic reticulum',
  'Lysosome': 'Lysosome',
  'Peroxisome': 'Peroxisome',
  'Plasma membrane': 'Cell membrane',
  'Chloroplast': 'Chloroplast',
  'Central vacuole': 'Vacuole',
  'Golgi stack': 'Golgi apparatus',
  'Palisade cell': 'Palisade cell',
  // Aspergillus hypha
  'Hyphal tip': 'Hypha',
  'Spitzenkörper': 'Spitzenkörper',
  'Woronin body': 'Woronin body',
  // viruses
  'Head': 'Capsid',
  'DNA genome': 'Escherichia virus T4',
  'Tail sheath': 'Escherichia virus T4',
  'Tail tube': 'Escherichia virus T4',
  'Baseplate': 'Escherichia virus T4',
  'Long tail fibre': 'Escherichia virus T4',
  'Fibre joint': 'Bacteriophage',
  'Spike': 'Coronavirus spike protein',
  'Envelope': 'Viral envelope',
  'RNA genome': 'SARS-CoV-2',
  'Virion': 'Virus',
};

/** The Wikipedia link for a label name, or undefined if it has none. */
export function wikiUrl(name: string): string | undefined {
  const title = ARTICLES[name];
  return title && `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
}
