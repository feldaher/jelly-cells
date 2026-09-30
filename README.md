# Jelly Cells (Biology Studies No. 010)

Cells as soft bodies. Grab them, stretch them, give them a nudge, and cut them open with a knife to see what is inside. Five specimens are in the dropdown:

| Cell | Inside |
|---|---|
| **Budding yeast** | cell wall, nucleus + nucleolus, vacuoles, mitochondrial network, septin ring, bud scars |
| **Red blood cell** | biconcave disc: membrane skeleton and haemoglobin, no nucleus |
| **Fibroblast** | flat and spread: nucleus, nucleoli, stress fibres ending in focal adhesions, mitochondria |
| **Microglia** | ramified processes, bean-shaped nucleus, lysosomes / phagolysosome, mitochondria |
| **Neuron** | soma, axon hillock, axon + terminal, dendrites, nucleolus, Nissl bodies, mitochondria |

Teaching aids:
- **Labels** that ride with the jelly; toggle them with the Labels button or `L`. Click one for a card with its real size, what it does, a real micrograph of the structure (EM, fluorescence or light, from Wikimedia Commons, credited with author and licence; `src/teach/micrographs.ts`) and a link to the Wikipedia article (`src/teach/wiki.ts`).
- **Clickable key**: click to hide an organelle, shift-click to show only that one, hover to highlight it.
- **"The cut passed through"**: after each cut, a report of what the blade crossed, with sizes and profile counts.
- **Scale bar** in µm that follows the zoom.
- **Stage slider**, one per cell. Press ▶ (or `P`) and the cell *morphs* through its stages: the jelly itself grows the bud, pulls in its processes or regrows its axon while it keeps wobbling. Dragging the slider scrubs the morph. The stages are:
  - *Yeast, cell cycle*: G1 → S → G2 → anaphase → telophase. The bud grows, the nucleus migrates into the neck, stretches through it and splits, and the septin ring divides in two.
  - *Microglia, activation*: surveilling → primed → reactive → amoeboid. Processes retract and thicken, the soma swells, lysosomes multiply.
  - *Neuron, injury response*: healthy → axotomy (retraction bulb, piled-up mitochondria) → chromatolysis (swollen soma, eccentric nucleus, dispersed Nissl bodies) → regeneration (sprout and growth cone).
  - *Red blood cell, shape change*: discocyte → echinocyte I → echinocyte III → spherocyte, at nearly constant volume.
  - *Fibroblast, wound response*: rounded → spreading → migrating → myofibroblast (thick α-SMA fibres, supermature adhesions).
- **Views**: *Anatomy* or *Deformation* (mechanical strain: Green–Lagrange strain from 0 to 30 %+, so you see where a pull or a squeeze goes). Deformation colours the knife faces too, so a cut shows it inside.

`?cell=neuron` (or `rbc`, `fibroblast`, `microglia`, `yeast`) opens a specific cell.

It is a static site: WebGPU for rendering and TypeScript XPBD physics on the CPU. There are no runtime dependencies.

Live: https://feldaher.github.io/jelly-cells/

## Run

```sh
npm install
npm run dev        # http://localhost:5173/jelly-cells/
npm test           # Gherkin scenarios + unit tests (vitest)
npm run build      # static site in dist/
```

It needs a browser with WebGPU: current Chrome or Edge, Safari 18+, or Firefox with WebGPU enabled.

## Controls

| | |
|---|---|
| **Hand** | Drag the cell to pull it. Scroll or use a second finger while holding to twist. Drag empty floor to orbit, scroll to zoom. |
| **Knife** | Draw a stroke across the cell. A vertical blade comes down along it and splits every piece it crosses. |
| Keys | `H` hand · `K` knife · `N` nudge · `R` reset · `L` labels · `[` `]` stage · `P` play/pause the morph · `Esc` close card · `Space` pause |
| `?debug` | Shows the physics step time in the status pill. |

## How it works

- **Cell types** (`src/cells`): each is a `CellType` (see `src/contracts.ts`). It provides a body (ellipsoids, tori and tapered tubes combined by smooth union or subtraction), organelles, labels, key, stiffness per material, camera and µm-per-unit scale.
- **Anatomy** (`src/anatomy`): the signed distance fields. The same functions exist in TypeScript and WGSL (`render/shaders/common.wgsl`).
- **Teaching** (`src/teach`, `src/ui/teach.ts`): section measurement, scale bar, label layout, Wikipedia links, micrographs and the overlay UI. The physics notes and their equations open in a modal (*Inside the experiment*).
- **Mesh** (`src/mesh`): a BCC tetrahedral lattice clipped to the piece's SDF, with boundary nodes snapped onto the surface. Each tet takes the material at its centroid. The render skin is a surface-nets isosurface; organelles are analytic meshes. Both are embedded in the tets by barycentric weights.
- **Physics** (`src/physics`): XPBD at a fixed 60 Hz step with 12 substeps. Each tet has a co-rotational shape constraint and a volume constraint on either side of it, and its stiffness is scaled by material (wall ×4, nucleus ×2, vacuole ×0.7). The rest are edge-relative damping, floor contact with friction, a soft grab, and contact between pieces. Pieces are solid to each other: a surface particle found inside another piece's tetrahedra is pushed back out along that piece's depth field (distance below its surface, carried through the deformed tet), with Coulomb friction, on top of a short-range particle cushion.
- **Cutting** (`src/cut`): the stroke defines a vertical world plane. It is carried into each piece's rest space through a best-fit rotation. Each side becomes a new piece (the SDF ∩ its half-spaces), built in a Web Worker while the knife presses its groove. The new pieces then inherit position and velocity from the flesh they came from.
- **Morphing** (`src/anatomy/morph.ts`, `src/app/morph.ts`): between stages the body's SDF is blended, d = (1 − t)·d<sub>i</sub> + t·d<sub>i+1</sub>, so new flesh appears first next to the old surface. Organelles are matched one to one; an unmatched one grows out of its nearest relative, and nothing is placed outside the blended body. A worker keeps re-meshing the cell a little further along. Each new particle starts at the old flesh it pulls back to (X − (d<sub>s</sub> − d<sub>s′</sub>)∇d<sub>s</sub>), so the new mesh begins in the old shape and its own elasticity carries it into the new one. Design notes: `docs/morph-micrographs-physics-modal.md`.
- **Rendering** (`src/render`): shadow map and a bottom-up contact map, then the opaque scene. Then, per piece from back to front, a back-face thickness pass and the jelly front faces: refraction, Beer–Lambert absorption, milky scattering and Fresnel/GGX. Knife faces show exact organelle sections by evaluating the SDFs at each fragment's rest position.

The types every layer agrees on live in `src/contracts.ts`. Behaviour is specified in `features/*.feature`.

## Deploy to GitHub Pages

1. Create an empty repository `feldaher/jelly-cells` on GitHub.
2. `git remote add origin git@github.com:feldaher/jelly-cells.git && git push -u origin main`
3. In the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.

`.github/workflows/pages.yml` runs the tests, builds, and publishes on every push to `main`. The Vite `base` is `/jelly-cells/`. If you rename the repo, change `base` in `vite.config.ts` to match.

## Scale

Each cell type maps sim units to µm (yeast 1, RBC 1.25, microglia 1.5, neuron 2, fibroblast 4), so labels, the scale bar, the cut report and the mass are in real units. The *dynamics* are illustrative: every cell moves as if it were a few centimetres of gelatin. At true size a cell lives at very low Reynolds number and would never visibly wobble.

## Image credits

The label-card micrographs are from Wikimedia Commons. They are public domain, CC0, CC BY or CC BY-SA; each card names the author and licence and links the file page. They are served as 640 px copies from `public/micrographs/`. Where Commons has no image of the right organism, the caption says what is shown instead (e.g. HeLa mitochondria on the yeast card).
