# Design: fission yeast, E. coli, organelle dynamics, fission, knife

Status: implemented, 2026-10-05. Sources and the numbers taken from them are in
`../outputs/literature/2026-10-05_cell-cycle-organelle-sources.md`; the growth-data analysis is in
`../outputs/analysis/2026-10-05_ecoli-single-cell-growth.md`.

## 1. Architecture

Nothing new at the top level: a cell is still a `CellType` that builds an `Anatomy` per whole
stage, `anatomyOf` blends neighbours, the morpher re-meshes keyframes. Four additions.

```
 published law (cells/cycle/*.ts)          pure functions of cycle phase, in µm and minutes
        │  length(φ), nucleus volume, replication state, waist …
        ▼
 cell file (cells/pombe.ts, ecoli.ts, yeast.ts)   µm → sim units, primitives per stage
        │  Anatomy (+ optional `fission` plane on the last stage)
        ▼
 anatomy/sdf.ts ↔ render/shaders/common.wgsl      one new primitive kind (Disc)
        ▼
 app/world.ts                                      divides the piece when a morph lands on a
                                                   stage that carries a `fission` plane
```

1. **Cycle laws, separate from geometry** (`src/cells/cycle/`). Each file holds the measured
   quantities of one organism as named constants with their source, and pure functions of the
   cycle phase φ ∈ [0, 1]. The cell files contain no biological number that is not either
   imported from there or a drawing choice (marked as such). Tests check the laws against the
   published values, and the built geometry against the laws.
2. **One new primitive, `Prim.Disc`**: a flat washer (centre, axis, outer and inner radius,
   half-thickness). It is what a septum growing inward from the wall is, and a closed septum is
   the same primitive with inner radius 0. A torus cannot do this: its tube would have to be as
   thick as the septum is wide.
3. **Six new materials** (ids 12–17): `Nucleoid`, `Spindle` (microtubules), `Ring` (the
   cytokinetic ring: actomyosin in yeasts, FtsZ in bacteria), `Septum`, `Golgi`, `Receptor`.
   The GPU colour table grows from 16 to 24 slots.
4. **Fission.** The last stage of a dividing cell is one connected body with a narrow bridge
   where the daughters are about to part, and carries `fission`: the rest-space plane through
   that bridge. When a morph *lands* on such a stage, `World` splits the piece along the plane
   with the same machinery as a knife cut (children embedded in the parent, motion carried
   over), without a knife. The two daughters are then separate soft bodies. Stepping back, or
   pressing play again, rebuilds a whole cell, as after any cut.

**Trust model.** Unchanged: a static site with no input other than the URL parameter `cell`,
which is checked against the list of cell types.

## 2. What each cell now shows, and where it comes from

Coarse-graining rule: a structure is drawn only if (a) it is larger than about a twentieth of
the cell, or it is the thing that divides the cell, and (b) its behaviour through the stages is
documented in a source we could read. Structures that fail (a) are named in the text only.
Diameters of filaments (microtubules, the rings) are drawn several times too thick to be seen;
their lengths and positions are to scale.

### Fission yeast (new; 1 unit = 1.25 µm)

| Quantity | Value | Source |
|---|---|---|
| Length at division; NETO | 14 µm; 9.5 µm at φ = 0.34 | Mitchison & Nurse 1985 |
| Growth | two linear segments over the first 75 % of the cycle, then constant length | Mitchison & Nurse 1985 |
| Diameter | 3.6 µm (drawing choice between the "∼4 µm" of Tran 2001 and the usual 3.5 µm) | Tran et al. 2001 |
| Nucleus / cell volume | 0.080 ± 0.013, constant through interphase | Neumann & Nurse 2007 |
| Interphase microtubules | 3–4 antiparallel bundles along the long axis, from the nucleus to the tips | Tran et al. 2001 |
| Mitochondria | tubules aligned with the microtubules; partly carried to the ends with the spindle poles; cut by Dnm1 at division | Yaffe 2003; Jourdain 2009 |
| Spindle | three phases; maximum length 11.9 ± 0.9 µm; mitosis ≈ 30 min | Nabeshima 1998; Krüger 2019 |
| Ring | assembled over 10 min after spindle-pole separation, starts to constrict at +37 min | Wu et al. 2003 |
| Septum | grows inward as the ring closes; wall synthesis, not the ring, supplies the force | Proctor et al. 2012 |
| New ends | rounded by turgor (1.5 ± 0.2 MPa) without growth; wall modulus 50 ± 10 MPa | Atilgan et al. 2015 |
| Vacuoles | many small ones that fuse in water and fragment in salt | Bone et al. 1998 |

Stages: Birth → NETO → Late G2 → Metaphase → Anaphase B → Septation → Fission.

### E. coli (new; 1 unit = 0.35 µm)

| Quantity | Value | Source |
|---|---|---|
| Birth and division length, 37 °C, LB | 2.12 ± 0.35 and 4.49 ± 0.53 µm (model: 2.2 → 4.4) | our analysis of Tanouchi et al. 2017 (10 189 cycles) |
| Growth law | exponential (smaller residual than linear in 99.9 % of cycles) | same |
| Size control | adder: slope of division on birth length 0.96 (0.92–1.00) | same; Taheri-Araghi 2015 |
| Generation time | 32 ± 5 min | same |
| C and D periods | 40 and 20 min | Cooper & Helmstetter 1968 |
| Z ring | assembles at about the start of D, well before constriction (strain MC4100) | den Blaauwen et al. 1999 |
| Septum closure | limited by wall synthesis (PBP3), not by the Z ring | Coltharp et al. 2016 |
| Nucleoid and ribosomes | two nucleoid lobes, three ribosome-rich regions (endcaps, mid-cell); 10–15 % of ribosomes inside the nucleoid | Bakshi et al. 2012 |
| Chemoreceptors | clustered at the poles | Maddock & Shapiro 1993 |
| Width | 1 µm (the "3 µm × 1 µm cell" of Bakshi 2012; not measured in the growth data) | Bakshi et al. 2012 |

With a 32 min generation and C + D = 60 min, rounds of replication overlap: a newborn cell
already carries a chromosome that is 70 % replicated, starts the next round at 4 min, finishes
the old one at 12 min and divides 20 min later. The stages follow this: Newborn → Termination
(two nucleoids, Z ring) → Elongation → Constriction → Division. The Z ring is gone from the last
stage: FtsZ leaves once the envelope has begun to invaginate (Wang et al. 2005).

### Budding yeast (revised)

- Nucleolus on the side of the nucleus away from the neck in interphase (it lies opposite the
  spindle pole body, which faces the bud: Yang et al. 1989); trailing toward the neck in anaphase.
- Nucleus volume 7 % of cell volume at every stage (Jorgensen et al. 2007).
- Spindle inside the nucleus: short at G2/M, spanning mother and bud in anaphase (Yeh et al. 1995).
- A myosin ring at the neck from bud emergence that contracts at cytokinesis between the two
  septin rings (Bi et al. 1998; Lippincott et al. 2001), then a septum.
- Vacuole inheritance: a stream of vacuole membrane toward the bud in S (Weisman 2006).
- A sixth stage, cytokinesis: the neck narrows to a short tube closed by the septum, and the
  cycle ends in fission of mother and daughter there.

### Fibroblast (revised)

- Golgi and centrosome: beside the nucleus at a random angle until the cell polarises, then in
  front of it, facing the leading edge (Kupfer et al. 1982); the nucleus moves rearward while the
  centrosome stays at the centroid (Gomes et al. 2005).
- Adhesion lengths: 2–6 µm classical, 8–30 µm supermature in the myofibroblast (Goffin et al. 2006).

### Microglia, neuron, red blood cell

Audited against the sources we could read. Three microglia texts were corrected (how fast
processes move, the order of convergence and retraction after injury, and what P2Y12 does:
Nimmerjahn 2005, Davalos 2005, Haynes 2006). No new structures: we found no quantitative,
stage-resolved source for one that passes rule (a). The red-cell dimensions and the neuron's
chromatolysis rest on sources whose text we could not open (Evans & Fung 1972; Lieberman 1971)
and are unchanged.

## 3. Contract changes (`src/contracts.ts`)

- `Mat`: + `Nucleoid: 12, Spindle: 13, Ring: 14, Septum: 15, Golgi: 16, Receptor: 17`; `MATERIAL_COUNT = 18`.
- `Prim`: + `Disc: 4`. `a` = centre, `b` = axis × half-thickness, `R` = outer radius, `r` = inner radius.
- `CellTypeId`: + `'pombe' | 'ecoli'`.
- `Anatomy.fission?: Plane`: rest-space plane along which the cell has just divided.
- `World.divide(): boolean`: splits the single whole piece along `an.fission`.

## 4. Knife

Geometry only (`cut/knife.ts`) and its shader (`blade.wgsl`); the physics of the blade is
untouched, and the cutting edge stays the straight line the physics uses. A chef's knife: a
tapered blade with a ground bevel and a spine that drops to the tip, a steel bolster, and a
riveted wooden handle with a rounded section. Steel reflects the studio and the floor colour
with a brushed, anisotropic highlight; the wood has a procedural grain and a thin lacquer.
Below the horizon a reflected ray is followed to the table: it shows the table with the shadows
that lie on it, or the cell if it passes through it on the way (the floor map already holds
the height of the cell's underside over every table point).
