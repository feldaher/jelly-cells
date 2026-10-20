# Sources for the cell cycles and organelles in Jelly Cells

Date: 2026-10-05. Project: jelly-cells. Roles: Literature Scout, Paper Synthesizer, Biology Expert.

How to read this. Each row gives what the simulation shows, the value, and how far we checked it this session:

- **A** read in the paper's abstract (PubMed) or full text (Europe PMC / PMC), wording or number confirmed.
- **B** our own analysis of published data (see `../analysis/2026-10-05_ecoli-single-cell-growth.md`).
- **C** standard textbook statement, or a number we know from the literature but could not open a source for this session. Treat as unverified.
- **D** a drawing choice or an assumption of ours, with no source.

PMC full text could not be fetched for several papers (the site blocks automated access), so many checks stop at the abstract.

## Fission yeast (*Schizosaccharomyces pombe*)

| Shown | Value | Source | Check |
|---|---|---|---|
| Length at division | 14 µm (wild type 972) | Mitchison & Nurse 1985, J Cell Sci 75:357, PMID 4044680 | A |
| New end take-off (NETO) | at 0.34 of the cycle, length 9.5 µm; before it only the old end grows | same | A |
| Growth in length | two linear segments over the first 75 % of the cycle, rate up 35 % at NETO; then constant | same | A |
| Birth length | 7 µm (half of 14) | derived | D |
| Split of growth between the ends after NETO | equal | none; the paper says old-end growth slows in some cells | D |
| Diameter | 3.6 µm | Tran et al. 2001 give "∼4 µm" (J Cell Biol 153:397, full text); 3.5 µm is the usual figure | D between A and C |
| Nucleus / cell volume | 0.080 ± 0.013; constant over a 35-fold size range; rapid envelope expansion in mitosis | Neumann & Nurse 2007, J Cell Biol 179:593, full text | A |
| Interphase microtubules | 3–4 antiparallel bundles along the long axis, plus ends at the tips; pushing centres the nucleus | Tran et al. 2001 | A |
| Division site set by the nucleus | via Mid1 | Daga & Chang 2005, PNAS 102:8228 | A |
| Mitochondria | lie along microtubules, moved by microtubule growth and shrinkage, not transported; part travels with the spindle poles | Yaffe et al. 2003, PNAS 100:11424 | A |
| Mitochondria at division | cut by Dnm1 | Jourdain et al. 2009, Cell Motil Cytoskeleton 66:509 | A |
| Spindle | three phases (formation, constant length, elongation) | Nabeshima et al. 1998, Mol Biol Cell 9:3211 | A |
| Longest spindle; duration of mitosis | 11.93 ± 0.9 µm in wild type; ≈ 30 min whatever the cell size | Krüger et al. 2019, eLife 8:e42182, full text | A |
| Metaphase spindle length | the nuclear diameter | derived: the spindle is inside the nucleus and spans it | D |
| Centromeres at the spindle pole body in G2 | | Funabiki et al. 1993, J Cell Biol 121:961 | A |
| Nucleolus | a distinct domain on one side of the nucleus | Uzawa & Yanagida 1992, J Cell Sci 101:267 | A |
| Ring assembly | band of proteins from −10 to +2 min around spindle-pole separation; condenses into a ring over the next 10 min; constricts from +37 min | Wu et al. 2003, Dev Cell 5:723 (25 °C) | A |
| Ring is dynamic; actin assembles in it | | Pelham & Chang 2002, Nature 419:82 | A |
| Septum, not the ring, provides the force | | Proctor et al. 2012, Curr Biol 22:1601 | A |
| New ends rounded by turgor without growth; turgor 1.5 ± 0.2 MPa; wall modulus 50 ± 10 MPa | | Atilgan et al. 2015, Curr Biol 25:2150 | A |
| Vacuoles | fuse in water, fragment in salt | Bone et al. 1998, Curr Biol 8:135 | A |
| Vacuoles | many small ones; 10 → 20 drawn | number not found in a source we could read | D |
| Newborn cell is already in G2 (G1 and S during septation) | | textbook | C |
| Wall thickness ≈ 0.2 µm | | textbook | C |
| Where metaphase, anaphase B and septation fall within the last quarter of the cycle | 0.80, 0.85, 0.93 | ours; only their order and the minutes of Wu 2003 are sourced | D |

Unresolved: with the anchor points we use (7 µm at birth, 9.5 µm at 0.34, 14 µm at 0.75) the growth rate rises by 49 % at NETO; Mitchison & Nurse report 35 %. Keeping 35 % would put the birth length at 6.7 µm instead of 7. We kept the three published anchor points. The full paper, which we could not open, would settle it.

## *Escherichia coli*

| Shown | Value | Source | Check |
|---|---|---|---|
| Birth and division length, generation time (LB, 37 °C) | 2.12 ± 0.35 µm, 4.49 ± 0.53 µm, 32.1 ± 5.1 min; model 2.2, 4.4, 32 | Tanouchi et al. 2017, Sci Data 4:170036 | B |
| Exponential elongation | better than linear in 17 088 of 17 111 cycles (99.9 %) | same | B |
| Adder | slope 0.96 (0.92–1.00) at 37 °C; not at 25 °C (1.25) | same; Taheri-Araghi et al. 2015, Curr Biol 25:385 | B, A |
| C and D periods | 40 and 20 min | Cooper & Helmstetter 1968, J Mol Biol 31:519 (no abstract available; strain B/r) | C |
| Overlapping rounds: born 70 % replicated, initiation at 4 min, termination at 12 min | | computed from τ, C and D | derived from B and C |
| Z ring assembles at about the start of the D period, well before constriction | | den Blaauwen et al. 1999, J Bacteriol 181:5167 (strains B/rA and MC4100) | A |
| Late division proteins arrive 14–21 min after the Z ring | | Aarsman et al. 2005, Mol Microbiol 55:1631 | A (not used as a number) |
| FtsZ leaves after invagination has begun | | Wang et al. 2005, Genes Dev 19:2367 (100 min generation) | A |
| Septum closure limited by wall synthesis (PBP3), not by the Z ring | | Coltharp et al. 2016, PNAS 113:E1044 | A (abstract; its rates could not be read) |
| FtsZ treadmilling carries the wall-building enzymes | | Bisson-Filho et al. 2017, Science 355:739 (mostly *B. subtilis*) | A |
| When a constriction becomes visible | half-way through D | ours | D |
| Waist closes linearly in radius | | ours | D |
| Nucleoid: two lobes, three ribosome-rich regions; 10–15 % of ribosomes inside it; 55 000 ribosomes, 4 600 RNA polymerases; 1.5 mm of DNA in a 3 µm × 1 µm cell | | Bakshi et al. 2012, Mol Microbiol 85:21, abstract and full text (30 °C, defined rich medium) | A |
| Nucleoid a radially confined helical ellipsoid; sisters separate in pulses | | Fisher et al. 2013, Cell 153:882 | A |
| Nucleoid lobe positions and radial size (0.32 µm) at each stage | | a drawing of the replication state | D |
| Width | 1 µm | Bakshi et al. 2012 (other strain and medium) | A, transferred |
| Chemoreceptors at the poles; 12 nm hexagonal lattice | | Maddock & Shapiro 1993, Science 259:1717; Briegel et al. 2009, PNAS 106:17181 | A |
| An array at both poles of every cell, of equal size | | ours | D |
| Envelope ≈ 30 nm in all | | Matias et al. 2003, J Bacteriol 185:6112 (abstract gives no thickness) | C |
| Min oscillation and nucleoid occlusion place the Z ring | | Raskin & de Boer 1999 could not be retrieved | C |
| Genome 4.6 Mbp | | textbook | C |
| Flagella | not drawn (20 nm thick) | | |

## Budding yeast (*Saccharomyces cerevisiae*)

| Shown | Value | Source | Check |
|---|---|---|---|
| Nucleus / cell volume | ≈ 7 %, nucleus grows with the cell through the cycle | Jorgensen et al. 2007, Mol Biol Cell 18:3523 | A |
| Nucleolus opposite the spindle pole body | | Yang et al. 1989, Chromosoma 98:123 | A |
| Spindle pole body faces the bud; nucleolus trails in anaphase | | textbook | C |
| Spindle: fast elongation carrying the nucleus into the bud, then a slower phase | | Yeh et al. 1995, J Cell Biol 130:687 | A |
| Spindle lengths drawn (1.5 µm at G2/M, ≈ 4 µm in mid-anaphase) | | not in a source we could read | D |
| Myosin ring at the bud site from before bud emergence; actin joins at the end of anaphase; contracts to a point; not essential | | Bi et al. 1998, J Cell Biol 142:1301 | A |
| Septin hourglass splits into two rings with the contractile ring between them | | Lippincott et al. 2001, J Cell Sci 114:1379 | A |
| Vacuole inheritance by transport of vacuole membrane into the bud | | Weisman 2006, Nat Rev Mol Cell Biol 7:243 | A (review abstract); the route drawn is schematic, D |
| Mitochondrial content scales with bud size | | Rafelski et al. 2012, Science 338:822 | A (not yet used in the geometry) |
| Cortical and perinuclear ER | not drawn | Du et al. 2001; West et al. 2011 | A, omitted: a thin shell cannot be drawn with our primitives |
| Cell and bud sizes | stylised | | D |

## Fibroblast

| Shown | Value | Source | Check |
|---|---|---|---|
| Golgi and centrosome together, in front of the nucleus facing the wound; random away from a wound | | Kupfer et al. 1982, PNAS 79:2603 | A |
| The nucleus moves rearward; the centrosome stays at the cell centroid | | Gomes et al. 2005, Cell 121:451 | A |
| Adhesions 2–6 µm, supermature 8–30 µm, about four times the stress; α-SMA recruited only above that tension | | Goffin et al. 2006, J Cell Biol 172:259 | A |
| α-SMA raises contractility; induced by TGF-β1 | | Hinz et al. 2001, Mol Biol Cell 12:2730 | A |
| Golgi in the myofibroblast | left where the migrating cell had it | | D |

## Microglia, neuron, red blood cell (no geometry changed)

| Shown | Source | Check |
|---|---|---|
| Processes continually extend and retract in the healthy brain | Nimmerjahn et al. 2005, Science 308:1314 | A |
| Processes converge on an injury within minutes, without the soma moving; ATP is the signal | Davalos et al. 2005, Nat Neurosci 8:752 | A |
| P2Y12 needed to turn toward nucleotides; lost on activation | Haynes et al. 2006, Nat Neurosci 9:1512 | A |
| Echinocyte sequence from one bilayer-couple parameter | Lim, Wortis & Mukhopadhyay 2002, PNAS 99:16766 | A |
| Red cell dimensions | Evans & Fung 1972, Microvasc Res 4:335 (no abstract available) | C |
| Chromatolysis | Lieberman 1971, Int Rev Neurobiol 14:49 (no abstract available) | C |

## Organelle motion and surface detail (second pass, 2026-10-05)

| Shown | Value | Source | Check |
|---|---|---|---|
| Fission yeast microtubule growth | 1.86 ± 0.54 µm/min | Tran et al. 2001, full text | A |
| Shrinkage after catastrophe | 9 µm/min (the value their model uses "to match" living cells) | same | A |
| Time at the tip before catastrophe | 1.5 min on average | same, abstract | A |
| For comparison: growth ≈ 3.0, shrinkage ≈ 4.5 µm/min, catastrophe 1.0 and rescue 1.9 per min | not used | Drummond & Cross 2000, Curr Biol 10:766 | A |
| How far a bundle shrinks back | to 15 % of the way to the tip | "to the nuclear region" | D |
| Nucleoid density waves | 5–10 % of density within 5 s, back and forth | Fisher et al. 2013 | A |
| Nucleoid surface lobes | noise of fixed amplitude | "longitudinal bundles" in the same paper | D |
| FtsZ treadmilling around the ring | the motion | Bisson-Filho et al. 2017 | A |
| Treadmilling speed | ≈ 30 nm/s | Yang et al. 2017 could not be retrieved | C |
| FtsZ in clusters | patchy ring | not read | C |
| Axonal mitochondria: bidirectional, moving and stationary states | | Morris & Hollenbeck 1993, J Cell Sci 104:917 | A |
| Speed of moving mitochondria | ≈ 0.5 µm/s | Misgeld et al. 2007 abstract gives no number | C |
| Nuclear pores, budding yeast | 65–182 per haploid nucleus, rising through the cycle, clustered, no preferred spacing | Winey et al. 1997, Mol Biol Cell 8:2119 | A |
| Same density on the fission yeast nucleus | | none | D |
| Pore density of animal nuclei is roughly constant across species | not drawn: below a pixel at these scales | Maul & Deaven 1977, J Cell Biol 73:748 | A |
| Budding yeast mitochondrial tubule diameter | 339 ± 5 nm (glucose), 360 ± 4 nm (glycerol) | Egner et al. 2002, PNAS 99:3370 | A |
| Yeast mitochondria fuse and divide continually | not animated | Jakobs et al. 2003, J Cell Sci 116:2005 | A |
| Golgi: stacks of seven cisternae, joined across a non-compact region | | Ladinsky et al. 1999, J Cell Biol 144:1135 (rat kidney cells) | A |
| Golgi stack width | drawn 1.6 µm; about 1 µm in the reconstruction | same | A, enlarged |
| Nissl body as a stack of rough-ER cisternae | three drawn | textbook | C |
| Chromatin clumps on animal nuclei (dense in microglia, sparse in neurons) | texture only | the existing label texts | D |
| Cristae stripes | spacing far wider than real | none | D |
| Min protein oscillation in E. coli | not drawn | Raskin & de Boer 1999 could not be retrieved | — |

## Data sets

- Tanouchi et al. 2017, figshare doi:10.6084/m9.figshare.c.3493548: analysed (B).
- No single-cell length data set for fission yeast was analysed; its growth law rests on Mitchison & Nurse 1985 as reported in the abstract.

## What would most improve accuracy next

1. The full text of Mitchison & Nurse 1985, to settle the birth length and the rate change at NETO.
2. C and D periods measured in MC4100 in LB (the growth data's strain and medium).
3. A measured timetable of constriction in *E. coli* (Coltharp et al. 2016, full text) to replace our half-way assumption.
4. Vacuole number and size in fission yeast through the cycle.
