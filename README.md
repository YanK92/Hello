# 3D Web Experience Template

An immersive, production-ready 3D web experience built with [Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).

## Features

- **Galaxy particle system** — 80k particles with branch-spiral distribution and color gradients
- **Floating 3D geometry** — Animated icosahedra, octahedra, and tetrahedra with PBR materials
- **Bloom post-processing** — Unreal Engine-style bloom via `UnrealBloomPass`
- **Mouse parallax** — Smooth camera movement driven by cursor position
- **Cinematic tone mapping** — ACES filmic tone mapping for realistic color reproduction
- **Animated hero UI** — CSS-animated overlay with staggered entrance effects
- **Fully responsive** — Adapts to any viewport and device pixel ratio

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Build for production

```bash
npm run build
npm run preview
```

## Project Structure

```
├── index.html          # Entry HTML with overlay UI
├── package.json
└── src/
    ├── main.js         # Three.js scene, particles, shapes, animation
    └── style.css       # Global styles and UI overlay
```

## Customisation

| What | Where |
|---|---|
| Particle count / colors | `buildGalaxy()` in `src/main.js` |
| Shape geometries / positions | `SHAPE_DEFS` array in `src/main.js` |
| Bloom strength | `UnrealBloomPass` constructor args |
| Hero copy | `index.html` `.hero` section |
| Color palette | CSS custom properties in `src/style.css` |

## Tech Stack

- [Three.js](https://threejs.org/) — 3D rendering
- [Vite](https://vitejs.dev/) — Dev server & bundler
