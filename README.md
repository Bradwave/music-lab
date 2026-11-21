# Music Lab

A personal collection of minimal, pixel-art Web Audio instruments, grooveboxes, and musical experiments—packaged as a zero-build static repo and installable PWA.

## Gear Rack

- **[SOL-16](./gear/sol-16/)** — Minimal pixel-art deep house & microhouse groovebox (4×4 grid, chromatic keybed, 8 patterns, punch-in FX, MIDI & WAV export).
- **[3AM](./gear/3am/)** — Berlin 3 AM 4-track magnetic tape loom (polyrhythmic anchor/echo engine, Night-Arc 01:00–07:00 mood shifter, dub throws & master tape FX).
- **[DUST](./gear/dust/)** — Minimal pixel-art spinning vinyl platter for Detroit jazz-wax & Jelinek micro-loops (12-bit sampled jazz buffers, Karplus-Strong upright bass, Focus Band stylus, 4-stage analog phaser, BBD chorus & WAV export).

## Structure

```text
music-lab/
├── index.html              # Unified Music Lab rack launcher
├── manifest.webmanifest    # Unified Music Lab PWA manifest
├── sw.js                   # Root service worker
├── styles/                 # Launcher styles
├── icons/                  # Music Lab PWA icons
├── shared/                 # Shared fonts & future common audio/UI modules
├── gear/                   # Standalone instruments & experiments
│   ├── sol-16/
│   └── 3am/
└── server.mjs              # Local static dev server (mirrors GitHub Pages)
```

## Local Development

Zero dependencies required (Node.js 18+):

```bash
npm run dev
```

Then open:
- Rack launcher: `http://127.0.0.1:4173/`
- SOL-16: `http://127.0.0.1:4173/gear/sol-16/`
- 3AM: `http://127.0.0.1:4173/gear/3am/`

## Publishing & PWA Installation (GitHub Pages)

1. Push this repo to GitHub (e.g., `Bradwave/music-lab`).
2. In **Settings → Pages**, deploy from the **`main`** branch root (`/`).
3. Install options:
   - **Single unified PWA:** Open `https://bradwave.github.io/music-lab/` and **Add to Home Screen** / **Install App**. Switching between instruments stays inside the standalone PWA window, and each instrument's `≡` menu includes a **← BACK TO MUSIC LAB** button.
   - **Individual instrument PWA:** Open `.../music-lab/gear/sol-16/` or `.../music-lab/gear/3am/` directly to install that instrument with its own icon.

## Adding New Gear

1. Create a new folder under `gear/<name>/` with its own `index.html` (and relative `./` asset paths).
2. Add a card for it in the root `index.html`.
3. Optionally include a `← BACK TO MUSIC LAB` link (`href="../../"`) in its menu for standalone PWA navigation.
