# Sources for the game layer and the stress lab in Jelly Cells

Date: 2026-10-05. Project: jelly-cells. Roles: Literature Scout, Biology Expert.
Companion to `../design/2026-10-05_gamification-brainstorm.md`.

Check levels, as in `2026-10-05_cell-cycle-organelle-sources.md`:

- **A** read in the paper's abstract (PubMed) or full text (Europe PMC), wording or number confirmed this session.
- **S** seen only in a web-search summary or a secondary page this session. Not opened at the source.
- **C** textbook statement or a number known from the literature, no source opened. Unverified.

Search record: PubMed through `eutils` (esearch + efetch, relevance sort, one query per paper); full text through the Europe PMC REST service where the paper is open access; general web search for games and education research. Not searched: Google Scholar, Web of Science, ERIC, arXiv. The education literature in particular was only sampled, not mapped.

## Yeast, hyperosmotic shock (first stress-lab case)

Source for the first five rows: Babazadeh et al. 2013, PLoS One 8:e80901, PMID 24278344, full text.

| Shown | Value | Check |
|---|---|---|
| Time to peak nuclear Hog1, by NaCl dose | 3 min at 0.1 M; 5 min at 0.4 M; ≈ 6, 15 and 25 min at 0.6, 0.8 and 1.0 M | A |
| Volume lost | ≈ 30 % at 0.4 M, almost fully regained by 45 min; ≈ 55 % at 0.8 M, only 10 % regained by 45 min | A |
| Msn2 nuclear/cytoplasmic ratio | peaks within 3 min at 0.1 M and 5 min at 0.4 M; at 1.0 M only a slight rise after 20 min | A |
| Hog1 phosphorylation | maximum within 5 min at 0.4 M, after 10 min at 0.8 M (less delayed than translocation) | A |
| Cause of the delay | diffusion and nuclear transport of Hog1 slow sharply after severe volume loss; attributed to crowding | A |
| Nuclear Hog1 adapts perfectly | steady-state nuclear enrichment returns to baseline whatever the step in osmolarity; one integrator, needs Hog1 kinase activity, acts on glycerol synthesis | A (abstract). Muzzey et al. 2009, Cell 138:160, PMID 19596242 |
| Initial turgor | 0.6 ± 0.2 MPa | A (abstract). Schaber et al. 2010, Eur Biophys J 39:1547, PMID 20563574 |
| Turgor lost | at relative volume 93.3 ± 6.3 %, i.e. a shock of 0.4 ± 0.2 Osm/l | A (abstract), same |
| Wall volumetric elastic modulus | 14.3 ± 10.4 MPa | A (abstract), same |
| Non-osmotic ("solid") volume | 33 to 49 % of the initial cell volume | A (full text), same |
| Plasmolysis | may occur at about 4 Osm/l | A (abstract), same |
| HOG activation tracks turgor loss | 1:1 | A (abstract), same |

Use in the game: the dose–response experiment can be built directly on the Babazadeh rows. The volume law should be the turgor model of Schaber et al., not plain Boyle–van 't Hoff: below about 0.4 Osm/l the wall relaxes and volume changes little; above it the cell behaves as an osmometer with a 33–49 % solid volume. The equations are in that paper's supplement, **not read yet**.

Note that Babazadeh doses are NaCl molarity and Schaber's are osmolarity; the conversion (roughly 2 Osm per mol NaCl, less the osmotic coefficient) has to be made explicitly.

## Yeast, heat shock and acidification

| Shown | Value | Source | Check |
|---|---|---|---|
| Msn2/Msn4 enter the nucleus under stress | heat shock, osmotic stress, carbon starvation, ethanol, sorbate; rapid, reversible, independent of protein synthesis; inversely related to PKA activity | Görner et al. 1998, Genes Dev 12:586, PMID 9472026 | A (abstract) |
| Stress identity and dose are encoded in Msn2 dynamics | amplitude, duration or frequency of nuclear translocation | Hao & O'Shea 2012, Nat Struct Mol Biol 19:31, PMID 22179789 | A (abstract) |
| Heat-triggered aggregation | > 170 endogenous proteins within minutes, in several compartments; not misfolded; disaggregated without degradation in recovery | Wallace et al. 2015, Cell 162:1286, PMID 26359986 | A (abstract) |
| Pab1 phase-separates under physiological heat and pH | forms hydrogels in vitro; RNA inhibits it; mutants that impede it lose fitness under prolonged stress | Riback et al. 2017, Cell 168:1028, PMID 28283059 | A (abstract) |
| Pab1 thresholds in vitro | above 39 °C at pH 6.4, or below pH 5.4 at 30 °C | attributed to Riback 2017 in a later Drummond-lab paper | **S**. Not found in the passages read; not used in the code |
| Pab1 in vitro onset | monomeric up to 33 °C; demixes from 36 °C at rising rates, within seconds at 42 °C; does not reverse on return to 30 °C; Q10 of radial growth ≈ 350 | Riback et al. 2017, full text (NCBI PMC efetch) | A |
| Pab1 in vivo, 46 °C | diffuse near 30 °C; in stress granules "within minutes" of a shift to 46 °C; after 2 min still mostly soluble; after 8 min most of it in the 8,000 g and 100,000 g pellets | Riback 2017; Wallace et al. 2015, full text | A |
| Pab1 in vivo, 42 °C | no foci by fluorescence microscopy; pelletable assemblies after 10 min; less aggregation after 30 min at 42 °C than after 10 min at 46 °C | Riback 2017; Wallace 2015 | A |
| Pab1 baseline | 75 % in the supernatant in unshocked cells | Wallace 2015 | A |
| Recovery | aggregators fully disaggregated after 60 min at 30 °C, not degraded; heat stress granule disassembly needs Hsp104 and Hsp70 | Wallace 2015 (full text); Cherkasov et al. 2013, Curr Biol 23:2452 (abstract) | A |
| Yeast stress granules are solid-like, controlled by disaggregases | | Kroschwald et al. 2015, eLife 4:e06807 (abstract) | A |
| Heat-induced Pub1 condensates dissolve in hours, starvation-induced ones in minutes | | Kroschwald et al. 2018, Cell Rep 23:3327 (abstract) | A |
| Number and size of Pab1 foci per cell; fraction of Pab1 assembled at 42 °C | | not found | none: drawn, see `yeast-jelly/docs/stress-lab.md` 3b |
| Acidified cytoplasm turns solid-like | reduced mobility of organelles and tracer particles, widespread protein assembly, required for survival of starvation | Munder et al. 2016, eLife 5:e09347, PMID 27003292 | A (abstract) |
| Stiffening | acidified spheroplasts about 2.5 times as stiff as controls (AFM indentation, 10 µm probes) | same, full text | A |

Caution for the game: the 2.5-fold figure is for spheroplasts. With the wall on, the cell is three orders of magnitude stiffer (same paper), so the whole-cell change would be invisible. If the jelly stiffens in the game, the label must say it shows the cytoplasm.

## Other cells (later stress cases)

| Shown | Value | Source | Check |
|---|---|---|---|
| Arsenite stress granules, mammalian cells | 1 mM arsenite, 20 min: 100 % of Ha-Ras cells and < 50 % of CCL39 fibroblasts have G3BP-positive granules; equal by 1 h | Tourrière et al. 2003, J Cell Biol 160:823 (republished 2023, PMID 37672657), full text | A |
| E. coli hyperosmotic shock | volume recovery in two phases; the first takes 15–20 min; full recovery from shocks up to 1 Osmol/kg without new protein synthesis | Pilizota & Shaevitz 2012, PLoS One 7:e35205, PMID 22514721 | A (abstract) |
| E. coli division site | Min system and nucleoid occlusion together place the ring at midcell; any position is competent without them | Yu & Margolin 1999, Mol Microbiol 32:315, PMID 10231488 | A (abstract) |
| E. coli division accuracy | measured by Guberman et al. 2008, PLoS Comput Biol 4:e1000233; accuracy is set before constriction starts | PMID 19043544, full text | A for the statement; **the number itself was not extracted** |
| Red cell in hypotonic and hypertonic media | swelling to a sphere then lysis; shrinkage and crenation | none opened | C |
| NF-κB and YAP translocation in fibroblasts | | none opened | C |
| Axon stump degenerates after axotomy; anucleate fragments die; minicells from polar division | | none opened | C |

The red cell needs care: the existing stage blurbs attribute echinocytes to ATP depletion, high pH or drugs (bilayer-couple idea), not to tonicity. An osmotic series for the red cell is a different shape sequence and needs its own sources.

## Game design and comparable projects

| Claim | Source | Check |
|---|---|---|
| Learning content integrated into the game's core gives better learning than content attached from outside | Habgood, Ainsworth & Benford 2005, Simulation & Gaming 36:483 | S (abstract page) |
| Gamification effects: cognitive g = 0.49 [0.30, 0.69], motivational g = 0.36, behavioural g = 0.25; only the cognitive effect stable among rigorous studies | Sailer & Homner 2020, Educ Psychol Rev 32:77 | S (abstract) |
| Game-based science learning: medium effect for gameplay design, small-to-medium for added mechanisms | meta-analysis indexed at NTNU; full reference not established | S |
| Students picture cells as 2D; reading sections is hard; stereology modules address it | O'Neil, ABLE Proceedings 2020, and related teaching reports | S |
| Foldit: players optimise the computed Rosetta energy and solved hard refinement problems | Cooper et al. 2010, Nature 466:756, PMID 20686574 | A (abstract) |
| EyeWire: players reconstruct neurons from serial EM images | Kim et al. 2014, Nature 509:331, PMID 24805243 | A (abstract) |
| CellCraft: significant quiz gain after 30 min | Wake Forest press release, 2010 | S; not a peer-reviewed evaluation |
| Immune Attack: players beat a control-game group on knowledge and confidence | developer's site | S; not independently confirmed |
| Meta!Blast evaluated in a museum with pre/post tests | search summary | S |
| Predict-observe-explain improves learning from simulations | none opened | C |
| Fission yeast *cut* mutants: septum bisects the undivided nucleus | search summary of PMC papers | S |
| Stentor fragments each regenerate a normal cell | search summary (Marshall lab review, PMC4019467) | S |

## What remains unverified

1. Pab1 in vitro thresholds (39 °C, pH 5.4) are still second-hand; the in vivo statements are now read at the source. No number was found for foci per cell or for the assembled fraction at 42 °C.
2. The Schaber volume–osmolarity equations: need the supplement.
3. E. coli division accuracy as a number.
4. Every row marked C.
5. No peer-reviewed learning-outcome study was found for any cell-biology video game in this pass; the CellCraft and Immune Attack claims come from their makers.

## Use in the code (added after the first stress-lab slice, 2026-10-05)

The yeast osmotic rows above are now constants in `yeast-jelly/src/cells/stress/osmotic.ts`, tested against these values in `features/stress.feature`. The choices that are ours and not measured (shape of the Hog1 rise, exponential recovery starting at the peak, recovery times at 0.1, 0.6 and 1.0 M, volume at 1.0 M, "almost completely" read as 95 %, uniform shrinkage of organelles, a two-fold nuclear contrast, 1.86 Osm per mol NaCl) are listed in `yeast-jelly/docs/stress-lab.md`, section 3. The Schaber turgor model was not used for the volume; the volumes are the two measured points of Babazadeh et al. joined by straight lines, as that paper describes the relation.

Heat shock (added the same day): the Pab1 rows are constants and comments in `yeast-jelly/src/cells/stress/heat.ts`, tested in `features/heat.feature`. Full texts of Riback 2017 and Wallace 2015 came through NCBI `efetch` with `db=pmc`, which works where the Europe PMC route returns nothing.

Recovery from heat (added the same day): the 20 and 60 minute statements of Wallace 2015 fix the end of the recovery curve; no dissolution time was read for the foci themselves (Cherkasov 2013 was read as an abstract only; Kroschwald 2015 shows granules after 80 min of recovery from 40 min at 46 °C). Wikimedia Commons was searched for a stress granule micrograph for the label card: only a schematic (licence 'Attribution', not one the app uses) and videos, so the card has no image.
