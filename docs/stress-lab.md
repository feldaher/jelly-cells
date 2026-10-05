# Design: the stress lab (budding yeast: hyperosmotic shock and heat shock)

Status: salt and heat implemented, 2026-10-05. Sources and how far each was checked are in
`../outputs/literature/2026-10-05_game-layer-and-stress-sources.md`.

## 1. What the player does

**Salt.** Chooses how much NaCl to add to the yeast's medium, watches the cell shrink and a tagged kinase
(Hog1-GFP) move into the nucleus, and collects one row per run: dose, lowest volume, time of the
Hog1 peak. The rows show the finding of Babazadeh et al. 2013: the stronger the shock, the more the
cell shrinks and the *later* the signal peaks.

**Heat.** Moves the cell from 30 °C to 42 or 46 °C and watches Pab1-GFP. At 46 °C foci appear
within minutes. At 42 °C the picture does not change, yet the assembled fraction climbs: the
assemblies are too small for the microscope. The rows record assembled Pab1 and whether foci
were seen.

## 2. Architecture

```
 measured response (cells/stress/osmotic.ts)   anchors with sources; pure functions of dose and minutes
        │  relVolume(dose, t), nuclearHog1(dose, t)
        ▼
 CellType.stress (cells/yeast.ts)              a StressResponse; cells without one have no lab
        ▼
 app/world.ts                                  holds the Medium and a cell clock; each step sets
        │                                      params.volume from the response
        ├──► physics/xpbd.ts                   the rest shape of every tet is scaled to that volume
        ├──► render/palette.ts                 Reporter view: a palette lit by the nuclear enrichment
        └──► ui/stress.ts + teach/runs.ts      dose buttons, live readout, the table of runs
```

1. **Response laws, separate from everything else** (`src/cells/stress/`), in the same style as
   `src/cells/cycle/`: constants with their source, pure functions, tests against the published
   values. No number about the response lives anywhere else.
2. **Stress and clock in `World`.** Choosing a dose starts a run at minute 0. Cell time runs
   60 times faster than the screen (one second is one minute), stated in the UI. It stops with
   Pause and slows with ¼ speed, because it advances with the simulation step.
3. **Volume is real in the soft body.** `SimParams.volume` scales the rest state of every
   tetrahedron uniformly: the volume constraint becomes det F = J and the shape constraint
   ‖F − J^⅓ R‖. The cell shrinks because its elastic rest shape shrinks, and the Volume readout is
   measured on the mesh, not copied from the law. Strain and the knife's plane are taken relative
   to the scaled rest shape, so a shrunken cell at rest shows no deformation and a cut lands
   where it is drawn.
4. **The Reporter view is a palette, not a shader.** The fluorescence look already exists. The
   reporter palette is dark everywhere except the cytoplasm and the nucleus, whose brightness is
   set by the nuclear enrichment. No WGSL changes.
5. **Runs.** A pure reducer keeps, per run, the lowest volume seen and the time at which the
   reporter was brightest. The UI draws it as a table.

## 3. The response, and what is measured in it

All from Babazadeh et al. 2013 (PLoS One 8:e80901) unless noted.

| Quantity | Value | Level |
|---|---|---|
| Doses | 0.1, 0.4, 0.6, 0.8, 1.0 M NaCl | measured |
| Time to peak nuclear Hog1 | 3, 5, ≈ 6, ≈ 15, ≈ 25 min | measured |
| Lowest volume | 70 % at 0.4 M, 45 % at 0.8 M; "approximately linear" in dose | measured at those two doses; linear between and beyond |
| Volume drop | "immediately" | measured; drawn over a fraction of a second so the jelly does not jolt |
| Volume regained by 45 min | 0.8 M: 10 % of what was lost. 0.4 M: "almost completely" | 0.8 M measured; 0.4 M taken as 95 % (ours) |
| Hog1 amplitude | grows with dose up to the loss of turgor, 0.4 Osm/l (Schaber et al. 2010: activation follows turgor loss 1:1) | rule from the abstract; NaCl taken as 1.86 Osm per mol (textbook) |
| Hog1 returns to baseline | perfect adaptation (Muzzey et al. 2009) | measured; drawn as following the remaining volume deficit |

Ours, not measured (each is a comment in the code):

- the shape of the Hog1 rise (a smooth ramp to the measured peak time);
- volume stays at its lowest until the Hog1 peak, then recovers exponentially;
- the recovery time constant at 0.1, 0.6 and 1.0 M (log-linear in dose through the two anchors);
- lowest volume at 1.0 M (32.5 %), which is the linear extrapolation and sits at the lower edge
  of the solid volume Schaber et al. estimate (33–49 %);
- the nucleus, vacuole and every organelle shrink in the same proportion as the cell;
- reporter contrast: at the largest response the nucleus is drawn twice as bright as the
  cytoplasm. The measured nuclear/cytoplasmic ratio was not read.

Each run starts from an unstressed cell. Stepping from one dose to another, or back to no salt
(a hypo-osmotic shock), is not modelled: 0 M gives a fresh cell.

## 3b. Heat shock: what is measured in it

From Wallace et al. 2015 (Cell 162:1286) and Riback et al. 2017 (Cell 168:1028), both read in
full text. The reporter is Pab1-GFP; the readout is Pab1 in pelletable assemblies, relative to
the largest response.

| Statement | Level |
|---|---|
| 30 °C: Pab1 diffuse | measured |
| 46 °C, 2 min: Pab1 still mostly soluble | measured |
| 46 °C: Pab1 in stress granules ("large cytosolic foci") "within minutes"; imaged at 8 min | measured |
| 46 °C, 8 min: most Pab1 pellets | measured ("most"; no fraction given) |
| 42 °C: no Pab1 foci under the microscope | measured |
| 42 °C, 10 min: pelletable Pab1 assemblies | measured |
| 42 °C, 30 min: less assembled than at 46 °C, 10 min | measured |
| Unstressed cells: 75 % of Pab1 in the supernatant | measured; the readout is relative to this baseline |
| Back at 30 °C: aggregating proteins partly back in solution after 20 min, fully after 60 min, not degraded | measured (Wallace 2015, for the group of aggregating proteins) |
| Granules "slowly disappear"; needs Hsp104/Hsp70 | measured (Cherkasov et al. 2013, abstract); no time read for the foci |

Ours, not measured:

- the level at 42 °C (half the largest response) and its rise over 30 min;
- the curve at 46 °C between the anchors (smooth, from 1 to 8 min), and foci starting at 2 min;
- recovery: both the assembled fraction and the foci fall along one smooth curve reaching zero at
  60 min (so about three quarters are left at 20 min); the foci are given the same time as the
  aggregates;
- moving between 42 and 46 °C: the cell carries on along the new temperature's curve from the
  level it has, and loses nothing while it is still hot;
- the foci themselves: eight per mother cell, in proportion in the bud, 0.26 µm across, at fixed
  places, brightening in place. Real granules grow and merge, and their number was not read;
- the Pab1 picture: nucleus at 0.4 of the cytoplasm, foci up to five times it, cytoplasm dimming
  by 40 % as the foci fill;
- no volume change with heat.

The condensates are ordinary organelle primitives (`Mat.Condensate`) built into the yeast anatomy
at every stage and hidden until a stress has formed foci (`World.hiddenMaterials`). The renderer,
knife faces and the cut report all honour that mask, so nothing new was needed in the shaders.

## 4. Contract

In `src/contracts.ts`: `StressState`, `StressResponse` (one per kind of stress, with its own
reporter, doses and look), `ReporterLook`, `RunRecord`; `CellType.stress?` is a list;
`ViewMode` gains `'reporter'`; `SimParams.volume`; `Mat.Condensate`.

## 5. Tests

`features/stress.feature` and `features/heat.feature`: the laws against the published numbers and statements, the soft body reaching the
target volume, strain and cut mapping under a scaled rest shape, the run reducer, the reporter
palette, and the world's clock.

## 6. The graph

A fixed figure at the bottom of the stage plots the reporter against time since the run began:
nuclear Hog1 for salt; foci (solid) and assembled Pab1 (dashed) for heat. Earlier runs of the
same stress stay as faint lines, so the later peak at a higher salt dose is visible directly. A
run that goes back to 30 °C carries on in the same graph, with a dotted tick at the change. The
graph draws what the response law returns at each moment; it is not a measurement on the mesh.
There is no separate count of foci: the eight drawn foci brighten and fade together.

## 7. Not yet

Other cells, Msn2 as a second salt reporter (its peak times are in the same paper), salt steps
from one dose to another or back to none (each salt dose still starts from an unstressed cell),
salt and heat combined, challenges, a micrograph for the stress granule card (Commons has none
under a licence used here).
