# Budding Yeast (Material Studies No. 010)

A budding yeast cell as a soft body. Grab it, stretch the neck, give it a nudge, and cut it open with a knife to see sections through the nucleus, nucleolus, vacuoles, mitochondrial network, septin ring and cell wall.

It is a static site: WebGPU for rendering and TypeScript XPBD physics on the CPU. There are no runtime dependencies.

Live: https://feldaher.github.io/yeast-jelly/

## Run

```sh
npm install
npm run dev        # http://localhost:5173/yeast-jelly/
npm test           # Gherkin scenarios + unit tests (vitest)
npm run build      # static site in dist/
```

It needs a browser with WebGPU: current Chrome or Edge, Safari 18+, or Firefox with WebGPU enabled.

## Controls

| | |
|---|---|
| **Hand** | Drag the cell to pull it. Scroll or use a second finger while holding to twist. Drag empty floor to orbit, scroll to zoom. |
| **Knife** | Draw a stroke across the cell. A vertical blade comes down along it and splits every piece it crosses. |
| Keys | `H` hand · `K` knife · `N` nudge · `R` reset · `Space` pause |
| `?debug` | Shows the physics step time in the status pill. |

## How it works

- **Anatomy** (`src/anatomy`): signed distance fields in µm. The cell is a smooth union of a mother and a bud ellipsoid. Organelles are primitives: ellipsoids, capsule chains for mitochondria, and tori for the septin ring and bud scars. The same functions exist in TypeScript and WGSL (`render/shaders/common.wgsl`).
- **Mesh** (`src/mesh`): a BCC tetrahedral lattice clipped to the piece's SDF, with boundary nodes snapped onto the surface. Each tet takes the material at its centroid. The render skin is a surface-nets isosurface; organelles are analytic meshes. Both are embedded in the tets by barycentric weights.
- **Physics** (`src/physics`): XPBD at a fixed 60 Hz step with 12 substeps. Each tet has a co-rotational shape constraint and a volume constraint on either side of it, and its stiffness is scaled by material (wall ×4, nucleus ×2, vacuole ×0.7). The rest are edge-relative damping, floor contact with friction, a soft grab, and particle contact between pieces.
- **Cutting** (`src/cut`): the stroke defines a vertical world plane. It is carried into each piece's rest space through a best-fit rotation. Each side becomes a new piece (the SDF ∩ its half-spaces), built in a Web Worker while the knife presses its groove. The new pieces then inherit position and velocity from the flesh they came from.
- **Rendering** (`src/render`): shadow map and a bottom-up contact map, then the opaque scene. Then, per piece from back to front, a back-face thickness pass and the jelly front faces: refraction, Beer–Lambert absorption, milky scattering and Fresnel/GGX. Knife faces show exact organelle sections by evaluating the SDFs at each fragment's rest position.

The types every layer agrees on live in `src/contracts.ts`. Behaviour is specified in `features/*.feature`.

## Deploy to GitHub Pages

1. Create an empty repository `feldaher/yeast-jelly` on GitHub.
2. `git remote add origin git@github.com:feldaher/yeast-jelly.git && git push -u origin main`
3. In the repo, go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.

`.github/workflows/pages.yml` runs the tests, builds, and publishes on every push to `main`. The Vite `base` is `/yeast-jelly/`. If you rename the repo, change `base` in `vite.config.ts` to match.

## Scale

The sim unit is 1 µm, and the mass shown is the cell's (~74 pg at 1.1 pg/µm³). The *dynamics* are illustrative: the cell is simulated as if it were 3 cm of gelatin. At its true size a yeast cell lives at very low Reynolds number and would never visibly wobble.
