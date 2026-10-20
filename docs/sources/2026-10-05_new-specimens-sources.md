# Sources for the animal cell, plant cell, Aspergillus hypha, bacteriophage T4 and coronavirus

Date: 2026-10-05. Project: jelly-cells. Roles: Literature Scout, Biology Expert.
Code: `yeast-jelly/src/cells/{animal,plant,aspergillus,phage,coronavirus}.ts`; specs in `features/celltypes.feature`.

Check levels, as in the other dossiers:

- **A** read in the paper's abstract (PubMed) or full text (NCBI PMC), wording or number confirmed this session.
- **B** read off a published image with a scale bar.
- **S** seen only in a web-search summary or a secondary page.
- **C** textbook value, no source opened. Unverified.
- **D** a drawing choice of ours.

Search record: PubMed through `eutils`; full text through NCBI `efetch db=pmc`; Milo & Phillips, *Cell Biology by the Numbers* (book.bionumbers.org); general web search. The plant and fungal numbers are the weakest: no primary source was opened for most of them.

## Bacteriophage T4 (the best-sourced specimen)

All from Yap & Rossmann 2014, Future Microbiol 9:1319 (PMC4275845, full text), which collects the cryo-EM structures, unless noted.

| Shown | Value | Check |
|---|---|---|
| Head | 1150 Å long, 850 Å wide, prolate icosahedron | A |
| Tail | 925 Å long, 240 Å wide sheath of 23 hexameric rings | A |
| Tail tube | 90 Å outside, 40 Å inside diameter | A |
| Baseplate | dome 270 Å high, 520 Å across; after triggering a star 120 Å high, 610 Å across | A (also Kostyuchenko et al. 2003, abstract) |
| Contracted sheath | 420 Å long, 330 Å wide; tube extends by about half its length | A (also Kostyuchenko et al. 2005, abstract). Mentioned in a label; not animated |
| Long tail fibres | six, 1450 Å long | A |
| Fibres folded against the tail on a free phage | "most long tail fibers are folded back against the tail sheath until irreversible adsorption" | A (Hu et al. 2015, PNAS 112:E4919, abstract). This is how they are drawn |
| Genome | 168 903 bp, about 300 gene products | A (Miller et al. 2003, abstract) |
| 930 copies of the major capsid protein | | C |
| Fibre thickness ≈ 4 nm; shell ≈ 3 nm | | C |
| Head drawn as a smooth ellipsoid; fibres drawn 14 nm thick; neck, collar, whiskers and short fibres left out | | D |

## SARS-CoV-2

| Shown | Value | Source | Check |
|---|---|---|---|
| Shape and size | roughly spherical, diameters centred around 100 nm, variable | Ke et al. 2020, Nature 588:498 (full text) | A |
| Spikes | 24 ± 9 prefusion S trimers per virion | same | A |
| Genome | ≈ 30 kb single RNA in a lumen ≈ 80 nm across, with RNPs | Yao et al. 2020, Cell 183:730 (abstract) | A |
| Spike height ≈ 20 nm, head ≈ 13 nm | | not read | C |
| RNP beads ≈ 15 nm, 30–35 per virion | | not read (Yao et al. report them; the numbers were not in the abstract) | C |
| Spikes sit at random and tilt | | Ke et al. 2020 (abstract speaks of flexibility) | A for flexibility, C for the rest |
| Spikes drawn as clubs 12–16 nm thick; membrane drawn 2.5 nm; M and E proteins left out; spikes spread evenly, then nudged | | | D |

## Animal cell (a composite)

| Shown | Value | Source | Check |
|---|---|---|---|
| Cell ≈ 20 µm across | HeLa cells at confluence compact to ≈ 20 µm | Milo & Phillips, "How big is a human cell?" | A (the book, citing BNID 103718 ff.) |
| Nucleus 8 µm | nuclei typically 2–10 µm; ≈ 10 µm in a fibroblast | Milo & Phillips, "How big are nuclei?" | A |
| ER share of membrane | up to 60 % of membrane area; > 10 % of cell volume | Milo & Phillips, ER chapter | A |
| Mitochondria | textbook shape ≈ 1 × 2 µm, often reticular; 10³–10⁴ per mammalian cell | Milo & Phillips, mitochondria chapter | A |
| Golgi: stacks of about seven cisternae | | Ladinsky et al. 1999, as already used for the fibroblast | as in the earlier dossier |
| Lysosome 0.1–1.2 µm, pH 4.5–5; peroxisome 0.1–1 µm; centriole 0.25 × 0.5 µm; membrane 4–5 nm; nucleolus ≈ 2 µm | | none opened | C |
| Numbers drawn (16 mitochondria, 12 lysosomes, 10 peroxisomes), membrane drawn 0.15 µm, positions | | | D |

## Plant cell (palisade mesophyll)

| Shown | Value | Source | Check |
|---|---|---|---|
| Chloroplasts per cell | about 121 (Landsberg erecta) and 83 (Wassilewskija) in Arabidopsis mesophyll cells | Pyke & Leech 1991 (abstract read: it describes the counting method, not the numbers); the numbers from a web-search summary of their papers | S |
| Cell 20 × 50 µm; chloroplast 5 µm across and 2–3 µm thick; vacuole up to 90 % of the volume; wall 0.1–0.3 µm; plasmodesmata ≈ 50 nm; nucleus 6–7 µm; Golgi as many separate stacks; peroxisomes against chloroplasts | | none opened | C |
| 48 chloroplasts drawn as flat discs 1.6 µm thick; vacuole drawn at about 42 % of the cell; wall drawn 0.6 µm; nucleus at one end | | | D |

## Aspergillus nidulans hypha

| Shown | Value | Source | Check |
|---|---|---|---|
| Width ≈ 3 µm | read against the 5 µm scale bar of a hyphal tip image | Taheri-Talesh et al. 2012, PLoS One 7:e31218, fig. 4H (Commons copy) | B |
| Spitzenkörper at the apex, where vesicle markers meet | | same image; Harris et al. 2005, Eukaryot Cell 4:225 (title and record only) | B / C |
| Septal pore 50–500 nm; Woronin bodies as wide as the pore or wider, 100–200 nm from it | | web-search summary of the Wikipedia article "Woronin body" | S |
| Several nuclei per compartment; nuclei ≈ 2 µm; wall ≈ 0.1 µm; vacuoles larger away from the tip; chitin and glucan wall | | none opened | C |
| Five nuclei, their spacing, three Woronin bodies, nine mitochondria, the pore drawn 0.4 µm | | | D |

## Micrographs added (Wikimedia Commons)

Sixteen files, each looked at on a contact sheet before its caption was written; licence and author as Commons records them (in `src/teach/micrographs.ts`). Where Commons had no suitable image the card shows a related one and says so in the caption: lysosomes (a macrophage engulfing a yeast), plant nucleus, ER, Golgi, mitochondria and peroxisomes (animal cells), Aspergillus nuclei, Woronin bodies, vacuoles and mitochondria.

## What remains unverified

Everything marked C or S, above all the plant cell dimensions, the Aspergillus numbers, the coronavirus spike and RNP sizes, and the chloroplast counts at the primary source.

## Added 2026-10-06 (second accuracy pass)

| Claim | Source | Check |
|---|---|---|
| Yeast peripheral ER: cytoplasmic cisternae, many tubules, and a large plasma-membrane-associated domain of tubules and fenestrated cisternae | West et al. 2011, J Cell Biol 193:333 | A (abstract) |
| S. cerevisiae has a dispersed Golgi; Pichia pastoris has coherent stacks | Rossanese et al. 1999, J Cell Biol 145:69 | A (abstract) |
| Golgi of interphase mammalian cells is a single ribbon of stacks; ER one continuous compartment touching mitochondria, trans Golgi and endo-lysosomes | Marsh et al. 2001, PNAS 98:2399 | A (abstract) |
| Seven cisternae per stack; bridges between cisternae of equal rank only; 394 vesicles within 0.2 µm | Ladinsky et al. 1999, J Cell Biol 144:1135 | A (abstract) |
| Stacked ER sheets joined by helicoidal ramps | Terasaki et al. 2013, Cell 154:285 | A (abstract) |
| Golgi and centrosome face the wound within minutes | Kupfer et al. 1982, PNAS 79:2603 | A (abstract) |
| Dendritic Golgi outposts | Horton & Ehlers 2003, J Neurosci 23:6188 | A (abstract) |
| A. nidulans: about 60 µm³ of cytoplasm per haploid nucleus | Fiddy & Trinci 1976, J Gen Microbiol 97:169 | A (abstract) |
| A. nidulans Golgi equivalents: polarised network of ring-shaped and fenestrated cisternae, excluded from the apical dome | Pantazopoulou & Peñalva 2009, Mol Biol Cell 20:4335 | A (abstract) |
| A. nidulans tip cells are multinucleate; benomyl cuts tip growth tenfold | Horio & Oakley 2005, Mol Biol Cell 16:918 | A (abstract) |
| SARS-CoV-2 RNPs: about 15 nm; 26 ± 11 counted, 30–35 estimated per virion | Yao et al. 2020, Cell 183:730 | A (full text) |
| SARS-CoV-2: one S trimer per about 1 000 nm² of membrane; spike centre about 14 nm above the membrane | Ke et al. 2020, Nature 588:498 | A (full text) |
| Stacked Golgi in S. pombe; grana about 0.5 µm; plant vacuole up to 90 % of the cell; Golgi cisterna size in yeast; ER tubules about 50 nm; microtubule 25 nm | none opened | C |
| Subcellular volumes of leaf cells (Winter, Robinson & Heldt) | searched on PubMed, not found | not checked |
