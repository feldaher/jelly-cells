// Real micrographs for the label cards, all from Wikimedia Commons (public domain,
// CC0, CC BY or CC BY-SA). Licence and author are as Commons records them (checked
// 2026-09-30); every image was looked at to confirm the caption. Where no image of the
// right organism exists, the caption says what is shown instead. Files are 640 px
// copies in public/micrographs.

import type { CellTypeId, Micrograph } from '../contracts';

type Pic = Omit<Micrograph, 'src'>;

const PICS: Record<string, Pic> = {
  'yeast-nucleus': { commons: 'File:Bakers yeast cytoplasm-nucleus.jpg', author: 'Tgru001', license: 'CC0', modality: 'Freeze-fracture EM',
    caption: 'Platinum replica of a freeze-fractured baker\'s yeast cell, showing the nucleus in its cytoplasm. Scale bar 0.1 µm.' },
  'hela-nucleoli': { commons: 'File:HeLa-Tubulin-HSP60-Fibrillarin-DNA.jpg', author: 'GerryShaw (EnCor Biotechnology)', license: 'CC BY-SA 4.0', modality: 'Fluorescence',
    caption: 'Human HeLa cells: nucleoli (red, fibrillarin) inside each nucleus (purple, DNA), with microtubules in green and mitochondria in yellow.' },
  'yeast-vacuoles': { commons: 'File:Yeast cells with vacuoles marked with Vph1-GF (16193318289).jpg', author: 'Henderson et al., eLife (2014)', license: 'CC BY 2.0', modality: 'Fluorescence',
    caption: 'Budding yeast whose vacuole membrane protein Vph1 is tagged with GFP: the bright compartments inside each cell are its vacuoles.' },
  'hela-mitochondria': { commons: 'File:HeLa mtGFP.tif', author: 'Simon Troeder', license: 'CC BY 4.0', modality: 'Fluorescence',
    caption: 'Human HeLa cells expressing mitochondria-targeted GFP. Yeast mitochondria form the same kind of branched tubular network, just under the cortex.' },
  'yeast-wall': { commons: 'File:Bakers yeast wall-membrane.jpg', author: 'Tgru001', license: 'CC0', modality: 'Freeze-fracture EM',
    caption: 'Freeze-fracture replica of baker\'s yeast at the wall–membrane boundary: the plasma membrane pressed against the wall, with its typical elongated furrows. Scale bar 0.1 µm.' },
  'yeast-sem': { commons: 'File:Saccharomyces cerevisiae SEM.jpg', author: 'Mogana Das Murtey and Patchamuthu Ramasamy', license: 'CC BY 3.0', modality: 'SEM',
    caption: 'Scanning electron micrograph of S. cerevisiae. The raised rings on the mothers are bud scars, one per daughter; some buds are still attached. Scale bar 5 µm.' },
  'yeast-septins': { commons: 'File:S cerevisiae septins.jpg', author: 'Philippsen Lab, Biozentrum Basel', license: 'Public domain', modality: 'Fluorescence',
    caption: 'S. cerevisiae with GFP-tagged septin (green) forming a collar at each mother–bud neck; cell outlines in red. Scale bar 10 µm.' },
  'yeast-dic': { commons: 'File:S cerevisiae under DIC microscopy.jpg', author: 'Masur', license: 'Public domain', modality: 'DIC',
    caption: 'Living S. cerevisiae in DIC microscopy (100× oil objective): single cells and mothers carrying small and large buds.' },
  'anaphase': { commons: 'File:Anaphase IF.jpg', author: 'Roy van Heesbeen', license: 'Public domain', modality: 'Fluorescence',
    caption: 'An animal cell in anaphase: chromosomes (blue) pulled apart by the spindle (green). Yeast mitosis is closed: the nuclear envelope stays intact and the whole nucleus stretches through the neck.' },
  'telophase': { commons: 'File:TelophaseIF.jpg', author: 'Roy van Heesbeen', license: 'Public domain', modality: 'Fluorescence',
    caption: 'An animal cell in telophase: two daughter nuclei (blue) re-forming either side of the spindle midzone (green).' },
  'spectrin': { commons: 'File:Spectrin localization under the neuronal plasme membrane..jpg', author: 'GerryShaw (EnCor Biotechnology)', license: 'CC BY-SA 3.0', modality: 'Confocal',
    caption: 'αII-spectrin (green) lining the membrane of cultured rat neurons; DNA in blue. Red cells carry their own spectrin in the same kind of net under the membrane.' },
  'rbc-light': { commons: 'File:Redbloodcells.jpg', author: 'Drs Noguchi, Rodgers and Schechter, NIDDK (NIH)', license: 'Public domain', modality: 'Light',
    caption: 'Human red blood cells in the light microscope. Each is packed with haemoglobin; the paler centre is the thin dimple.' },
  'rbc-sem-colour': { commons: 'File:Red White Blood cells.jpg', author: 'Electron Microscopy Facility, NCI-Frederick', license: 'Public domain', modality: 'SEM',
    caption: 'False-coloured scanning electron micrograph: a red blood cell with its central dimple, beside a platelet (yellow) and a white blood cell (blue).' },
  'rbc-sem': { commons: 'File:Red blood cells (2).jpg', author: 'Scootdive', license: 'CC BY-SA 3.0', modality: 'SEM',
    caption: 'Scanning electron micrograph of red blood cells, some tilted edge-on to show the thick rim around the thin middle. Scale bar 1.19 µm.' },
  'rbc-crenated': { commons: 'File:Crenated Red Cells.jpg', author: 'Osaretin', license: 'CC BY-SA 4.0', modality: 'Light',
    caption: 'A blood smear with crenated red cells (echinocytes), their edges scalloped into bumps, among normal smooth discs.' },
  'rbc-echinocytes': { commons: 'File:Scanning electron microscopy (SEM) of echinocytes.png', author: 'Geekiyanage N. M. et al.', license: 'CC BY 4.0', modality: 'SEM',
    caption: 'Scanning electron micrographs of echinocytes, from rounded bumps (left) to sharp spicules all over the cell (right). Scale bar 2 µm.' },
  'rbc-spherocyte': { commons: 'File:Red Blood Cells observed with scanning electron microscope (SEM). Left spherocyte. Right normal red blood cell.png', author: 'Joan-Lluis Vives-Corrons and Elena Krishnevskaya', license: 'CC BY 4.0', modality: 'SEM',
    caption: 'Scanning electron micrograph of a spherocyte (left) next to a normal biconcave red cell (right).' },
  'fibroblast-nucleus': { commons: 'File:MouseChromosomeTerritoriesBMC Cell Biol6-44Fig2e.jpg', author: 'Mayer R., Brero A., von Hase J., Schroeder T., Cremer T., Dietzel S.', license: 'CC BY 2.0', modality: 'Fluorescence',
    caption: 'The nucleus of a mouse fibroblast, DNA in blue, with chromosomes 2 (red) and 9 (green) painted by FISH: each chromosome keeps to its own territory.' },
  'focal-adhesions': { commons: 'File:Focaladhesion.jpg', author: 'Christoph Moehl (Pommesbude)', license: 'CC BY 2.5', modality: 'Fluorescence',
    caption: 'A fibroblast stained for vinculin (red) and actin (green). Adhesions begin as small dots at the edge and grow into these plaques at the ends of the stress fibres. Scale bar 20 µm.' },
  'focal-adhesion-detail': { commons: 'File:Focaladhesiondetail.jpg', author: 'Christoph Moehl (Pommesbude)', license: 'CC BY-SA 2.5', modality: 'Fluorescence',
    caption: 'Detail of a fibroblast: vinculin-rich focal adhesions (red) at the ends of actin stress fibres (green). Scale bar 10 µm.' },
  'fibroblast-mitochondria': { commons: 'File:Indian Muntjac fibroblast cells (24271618921).jpg', author: 'ZEISS Microscopy (sample: Michael W. Davidson, FSU)', license: 'CC BY 2.0', modality: 'Fluorescence',
    caption: 'Indian muntjac fibroblasts: mitochondria in red (MitoTracker) threaded among actin stress fibres (green, phalloidin); nuclei blue (DAPI). Scale bar 20 µm.' },
  'fibroblast-stress-fibres': { commons: 'File:Indian Muntjac fibroblast cells (24327908636).jpg', author: 'ZEISS Microscopy (sample: Michael W. Davidson, FSU)', license: 'CC BY 2.0', modality: 'Fluorescence',
    caption: 'Actin stress fibres (green, phalloidin) running the length of Indian muntjac fibroblasts; mitochondria red, nuclei blue. Scale bar 20 µm.' },
  'mef-actin': { commons: 'File:MEF microfilaments.jpg', author: 'Y tambe', license: 'CC BY-SA 3.0', modality: 'Fluorescence',
    caption: 'Actin filaments (green) in mouse embryonic fibroblasts spreading and pulling on their substrate. Scale bar 10 µm.' },
  'myofibroblast': { commons: 'File:Diferenciación de fibroblastos a miofibroblastos cardíacos 2x2.jpg', author: 'Leslye Venegas and Danica Jiménez', license: 'CC BY 4.0', modality: 'Phase contrast',
    caption: 'Cardiac fibroblasts in culture 0, 24, 48 and 72 h after TGF-β, the signal that turns them into myofibroblasts.' },
  'fibroblast-sem': { commons: 'File:Fibroblasts 1.jpg', author: 'Judyta Dulnik', license: 'CC BY-SA 4.0', modality: 'SEM',
    caption: 'Scanning electron micrograph of mouse fibroblasts on an electrospun nanofibre scaffold: some still rounded, others spreading thin membrane over the fibres. Scale bar 10 µm.' },
  'lamellipodium': { commons: 'File:Lamellipodium.png', author: 'Yang T. D. et al.; Alexandre Saez', license: 'CC BY-SA 3.0', modality: 'Phase contrast',
    caption: 'A crawling cell in phase contrast, with thin lamellipodia at its leading edge (green arrows), and sketches of the crawling cycle (right). Scale bar 50 µm.' },
  'microglia-iba1': { commons: 'File:Microglial cells.tif', author: 'J. Wegiel', license: 'CC BY 4.0', modality: 'Fluorescence',
    caption: 'Microglia (red, IBA1) scattered through brain tissue; DNA in blue marks every nucleus.' },
  'phagocytosis': { commons: 'File:Phagocytosis of a Dead Yeast Particle (6830921067).jpg', author: 'NIAID', license: 'CC BY 2.0', modality: 'SEM',
    caption: 'False-coloured scanning electron micrograph of a phagocyte (grey) wrapping a dead yeast particle (zymosan, gold). Engulfed debris like this ends up in a phagolysosome.' },
  'microglia-ramified': { commons: 'File:Microglial cells (red) in rat cerebellar molecular layer.jpg', author: 'GerryShaw (EnCor Biotechnology)', license: 'CC BY-SA 4.0', modality: 'Fluorescence',
    caption: 'Ramified microglia (red, IBA-1) in the molecular layer of the rat cerebellum, their thin processes reaching out between other cells; nuclei blue.' },
  'microglia-lps': { commons: 'File:LPS induces microglia activation in vitro.png', author: 'da Silveira Cruz-Machado S. et al.', license: 'CC BY 4.0', modality: 'Light',
    caption: 'Immunostained microglia without (left, ramified, arrows) and with the bacterial toxin LPS (right, arrowheads): activated, they pull in their processes and round up.' },
  'macrophages-lectin': { commons: 'File:Makrofagi 2.jpg', author: 'Grzegorz Wicher', license: 'Public domain', modality: 'Light',
    caption: 'Lectin-stained (brown) macrophages in injured rat cortex: round cells with short, stubby extensions. Activated microglia take this amoeboid form.' },
  'mitochondrion-cryo': { commons: 'File:MitochondrionCAM.jpg', author: 'Carmmann (Wadsworth Center)', license: 'Public domain', modality: 'Cryo-ET',
    caption: 'A frozen-hydrated rat liver mitochondrion reconstructed by electron tomography: the cristae are tubular invaginations of the inner membrane.' },
  'microglia-lectin': { commons: 'File:Mikroglej 1.jpg', author: 'Grzegorz Wicher', license: 'Public domain', modality: 'Light',
    caption: 'Ramified microglia stained with lectin (brown). Each fine process ends in a tip that samples its surroundings.' },
  'neuron-nissl': { commons: 'File:Nissl bodies in neurons of the spinal cord.jpg', author: 'Tulemo', license: 'CC BY-SA 4.0', modality: 'Light',
    caption: 'Motor neurons in the spinal cord (cresyl violet and luxol fast blue): purple Nissl bodies (arrows) crowd the cytoplasm around a pale nucleus with a dark nucleolus. Scale bar 30 µm.' },
  'neuron-nucleoli': { commons: 'File:38F3-ChkNFH-DAPI-Shsy5y.jpg', author: 'GerryShaw (EnCor Biotechnology)', license: 'CC BY-SA 4.0', modality: 'Fluorescence',
    caption: 'Human SH-SY5Y neuroblastoma cells: nucleoli (green, fibrillarin) inside the nuclei (blue, DAPI); neurofilament NF-H in red.' },
  'axon-initial-segment': { commons: 'File:MBP-Ank3-Rat-Cerebral-Cortex.jpg', author: 'GerryShaw (EnCor Biotechnology)', license: 'CC BY-SA 4.0', modality: 'Confocal',
    caption: 'Rat cerebral cortex. Ankyrin-G (red) marks axon initial segments, the stretch just past the hillock where spikes start; myelin in green (MBP), nuclei in blue. Scale bar 20 µm.' },
  'dendritic-spines': { commons: 'File:Dendritic spines.jpg', author: 'Tmhoogland', license: 'Public domain', modality: 'Two-photon',
    caption: 'A dendrite of a striatal medium spiny neuron expressing EGFP, studded with spines, each a site of synaptic input. Scale bar 1 µm.' },
  'axon-mitochondria': { commons: 'File:Mitocondria Axon Presinaptico.PNG', author: 'Fischer T. D., Dash P. K., Liu J., Waxham M. N.', license: 'CC BY 4.0', modality: 'Cryo-ET',
    caption: 'Cryo-electron tomogram of a presynaptic swelling on an axon (left) and its 3D segmentation (right): mitochondria (green), microtubules, ER and vesicles.' },
  'myelinated-axon': { commons: 'File:Myelinated neuron.jpg', author: 'Electron Microscopy Facility, Trinity College (uploaded by Roadnottaken)', license: 'CC BY-SA 3.0', modality: 'TEM',
    caption: 'Transmission electron micrograph of an axon in cross-section, wrapped in compact myelin, with a mitochondrion inside. Scale bar 500 nm.' },
  'nmj-terminal': { commons: 'File:Electron micrograph of neuromuscular junction (cross-section).jpg', author: 'National Institute of Mental Health', license: 'Public domain', modality: 'TEM',
    caption: 'Electron micrograph of a neuromuscular junction: the axon terminal (T), full of synaptic vesicles, over a muscle fibre (M) with its junctional folds (arrow). Scale bar 0.3 µm.' },
  'wallerian': { commons: 'File:Wallerian degeneration in cut and crushed PNS nerve.jpg', author: 'Beirowski B. et al.', license: 'CC BY 2.0', modality: 'Fluorescence',
    caption: 'Fluorescent axons in a cut or crushed peripheral nerve, 37–44 h after the injury: intact at first, then broken into fragments (Wallerian degeneration).' },
  'growth-cone': { commons: 'File:Growthcone.jpg', author: 'Paul Letourneau, University of Minnesota (via NIH)', license: 'Public domain', modality: 'Fluorescence',
    caption: 'The growth cone of an elongating axon: actin (red) fills the filopodia and lamellipodium; microtubules (green) run up the axon shaft.' },
};

/** Which image each label shows, by "cell:Label name" first, then by name alone; a caption here replaces the image's own. */
const LABELS: Record<string, string | { pic: string; caption: string }> = {
  // yeast
  'yeast:Nucleus': 'yeast-nucleus',
  'yeast:Nucleolus': { pic: 'hela-nucleoli', caption: 'Nucleoli (red, fibrillarin) in human HeLa cells. In yeast the nucleolus is a single crescent against the nuclear envelope, marked by the same protein (called Nop1 there).' },
  'yeast:Mitochondria': 'hela-mitochondria',
  'Vacuole': 'yeast-vacuoles',
  'Cell wall': 'yeast-wall',
  'Bud scar': 'yeast-sem',
  'Septin ring': 'yeast-septins',
  'Bud (daughter)': 'yeast-dic',
  'Anaphase bridge': 'anaphase',
  'Daughter nucleus': 'telophase',
  // red blood cell
  'Membrane skeleton': 'spectrin',
  'Haemoglobin': 'rbc-light',
  'Central dimple': 'rbc-sem-colour',
  'Rim': 'rbc-sem',
  'Crenation': 'rbc-crenated',
  'Spicule': 'rbc-echinocytes',
  'Spherical shape': 'rbc-spherocyte',
  // fibroblast
  'fibroblast:Nucleus': 'fibroblast-nucleus',
  'fibroblast:Nucleolus': { pic: 'hela-nucleoli', caption: 'Nucleoli (red, fibrillarin) in human HeLa cells, several per nucleus (purple), as in fibroblasts.' },
  'fibroblast:Mitochondria': 'fibroblast-mitochondria',
  'Nascent adhesion': 'focal-adhesions',
  'Focal adhesion': 'focal-adhesion-detail',
  'Stress fibre': 'fibroblast-stress-fibres',
  'Radial fibre': 'mef-actin',
  'α-SMA stress fibre': 'myofibroblast',
  'Spreading skirt': 'fibroblast-sem',
  'Spreading edge': 'lamellipodium',
  'Lamellipodium': 'lamellipodium',
  'Trailing edge': { pic: 'lamellipodium', caption: 'A crawling cell in phase contrast: lamellipodia lead at the front (green arrows) while a long tail trails behind, still anchored until its adhesions let go. Scale bar 50 µm.' },
  // microglia
  'microglia:Nucleus': 'microglia-iba1',
  'microglia:Mitochondria': 'mitochondrion-cryo',
  'Phagolysosome': 'phagocytosis',
  'Ramified process': 'microglia-ramified',
  'Retracting process': 'microglia-lps',
  'Pseudopod': 'macrophages-lectin',
  'Process tip': 'microglia-lectin',
  // neuron
  'neuron:Nucleus': 'neuron-nissl',
  'neuron:Nucleolus': 'neuron-nucleoli',
  'neuron:Mitochondria': 'axon-mitochondria',
  'Nissl body': 'neuron-nissl',
  'Axon hillock': 'axon-initial-segment',
  'Dendrite': 'dendritic-spines',
  'Axon': 'myelinated-axon',
  'Axon terminal': 'nmj-terminal',
  'Axon stump': 'wallerian',
  'Retraction bulb': { pic: 'wallerian', caption: 'After a cut, the part of the axon cut off from the cell body fragments within two days (fluorescent axons, 37–44 h after injury). The part still joined to the soma survives and seals into a retraction bulb (not shown).' },
  'Growth cone': 'growth-cone',
};

/** The micrograph for a label of a cell type, or undefined if it has none. */
export function micrograph(cell: CellTypeId, name: string): Micrograph | undefined {
  const entry = LABELS[`${cell}:${name}`] ?? LABELS[name];
  if (!entry) return undefined;
  const key = typeof entry === 'string' ? entry : entry.pic;
  const pic = PICS[key];
  return pic && { ...pic, src: `micrographs/${key}.jpg`, ...(typeof entry === 'string' ? {} : { caption: entry.caption }) };
}

/** Commons page of a file, and the deed of its licence. */
export function commonsPage(m: Micrograph): string {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(m.commons.replace(/ /g, '_'))}`;
}
export function licenseUrl(m: Micrograph): string | undefined {
  const cc = /^CC BY(-SA)? ([0-9.]+)$/.exec(m.license);
  if (cc) return `https://creativecommons.org/licenses/by${cc[1] ? '-sa' : ''}/${cc[2]}/`;
  if (m.license === 'CC0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  return undefined;
}
