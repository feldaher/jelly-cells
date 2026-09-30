# Design: smooth stage morph, label micrographs, physics modal

Status: implemented, 2026-09-30.

## 1. Smooth 3D morph between stages

**Goal.** The jelly itself grows the bud, extends or retracts processes, regrows the
axon, and so on, continuously between stages, while it keeps wobbling. It must not
jump from one rebuilt mesh to the next.

### Anatomy at a fractional stage

`anatomyOf(id, seed, s)` accepts any real `s` in `[0, stages − 1]`. With
`i = ⌊s⌋` and `t = s − i`, it returns `morphAnatomy(A_i, A_{i+1}, t)`. The cell files
are unchanged and still build integer stages only.

`morphAnatomy(A, B, t)` (`src/anatomy/morph.ts`):

- **Body: SDF interpolation.** `d_t(x) = (1 − t)·d_A(x) + t·d_B(x)`. The body list
  becomes A's parts, then B's parts; B's first part carries a new op, `'morph'`, whose
  `blend` holds `t`. The TS and WGSL evaluators both implement it. Interpolating two
  SDFs handles any change of topology, and it reads as growth: new material appears
  first where `d_A` is small, so a bud swells out of the mother's surface and a
  regrowing axon extends from its stump.
- **Organelles: matched primitives.** Within each (material, kind), the i-th primitive
  of A is lerped to the i-th of B. An unmatched primitive *emerges from*, or *collapses
  into*, the nearest same-material primitive on the other side (size → 0 at its
  centre); with no same-material partner it shrinks in place. Size-zero primitives
  (size < 0.02) are dropped. Order follows material priority, from B when `t ≥ ½`,
  otherwise from A.
- **Tubules** (mitochondria, stress fibres): polylines are resampled to a common
  point count and matched the same way. Their capsules in `organelles` are regenerated
  from the interpolated polylines.
- **Containment.** Organelles move linearly, but the blended body grows its new parts
  late: a bud reaches only 0.065 µm past the mother at t = ¼ of G1 → S, then 0.6 µm at
  t = ½. So an organelle whose centre would lie outside the blended body is left out, and
  a tubule is trimmed to the stretches whose centreline is inside. Found in the browser
  (a mitochondrion floating beside the emerging bud); covered by the feature "Organelles
  stay inside the cell between stages".
- Scalars (wall thickness, cortex depth, mesh spacing) are lerped, and `bounds` is the
  union of A's and B's bounds.
- `t = 0` returns A itself and `t = 1` returns B itself.

**Labels** at stage `s` come from the nearest integer stage, `labels(anatomyOf(round(s)))`,
because label logic is written per stage.

### Keyframe re-meshing with elastic carry-over

Re-meshing takes 50–260 ms per build (measured in node), so the morph re-meshes
continuously in the existing worker and swaps each new mesh in:

1. `World.morphTo(target, rate)` sets a target stage. While `s ≠ target`, the
   `Morpher` asks the worker to build keyframe `s' = s + clamp(target − s, ±rate·Δt_build)`.
2. The worker builds the new piece at `s'` and computes where each new particle *starts*.
   - Pull-back `Φ`: for a new rest point `X`, `Y = X − (d_s(X) − d_{s'}(X))·∇d_s(X)`.
     `Y` is the corresponding point in the old rest shape: its depth below the new
     surface is preserved relative to the old surface. Where the shape did not change,
     `Y = X`.
   - `Y` is embedded in the old rest mesh (`tetId`, `bary`, the same as a knife cut).
3. The main thread swaps the piece in. Each new particle takes the *current* position
   and velocity of the old flesh at `Y` (`transferState`). The new mesh therefore starts
   in the old deformed shape, and its own rest shape is slightly different. The XPBD
   shape constraints then pull the jelly to the new shape over the next frames, which
   smooths the steps between keyframes into continuous, physically driven growth. The
   Deformation view shows that growth strain.
4. Organelle and skin meshes come with the new piece. The GPU anatomy buffer is
   re-uploaded, and the grab is carried to the nearest new particles.

Constraints:

- The morph applies to the intact cell only. With cut pieces present, a stage change
  resets to the intact cell first, as it does today.
- Starting a cut, changing cell type or pressing Reset cancels the morph.
- Mass and volume use the new rest volume, because a growing cell gains mass.
- The rate is ≈ 1 stage per 3.5 s for ▶ Play and ≈ 1 stage per 1.2 s for a slider
  change. Keyframe spacing adapts to how fast the machine builds.

### UI

- A ▶/❚❚ button next to the stage slider plays from the current stage to the last one,
  or restarts from the first stage if already at the end. Key: `P`.
- The slider follows the morph continuously. The title, blurb and ticks show the
  nearest stage.

## 2. Real micrographs on label cards

- `src/teach/micrographs.ts`: `micrograph(cell, labelName) → Micrograph | undefined`.
  It first looks up a per-cell entry, then an entry keyed by name only.
- Images come from Wikimedia Commons only. Accepted licences are Public domain, CC0,
  CC BY and CC BY-SA. Each entry records the Commons file title, author, licence,
  licence URL, modality (TEM / SEM / fluorescence / light), and a caption saying what
  is shown and in which organism.
- The files are downloaded as ≤ 640 px thumbnails into `public/micrographs/`, so the
  site does not depend on hotlinking. The card shows the image, the caption, and a
  credit line (author · licence · link to the Commons file page), as the CC licences
  require.
- Every entry is checked against the Commons API for its licence and author, and by
  viewing the image to confirm it shows what the caption says. A test checks that every
  label at every stage has an entry, that the licence is in the allowed set, and that
  the local file exists.

## 3. Physics modal

The `<details class="inside">` block becomes a `<dialog>` opened by an "Inside the
experiment" button. It closes with ×, Esc or a click on the backdrop. Its content is
the existing prose plus the governing equations: the XPBD update, the co-rotational
and volume constraints, and the Green–Lagrange strain. Each equation is stated as the
code implements it (`src/physics/xpbd.ts`, `src/teach/fields.ts`) and was checked
against those files.
