# SOL-16 — Pixel House Groovebox PWA

A minimal, tactile, offline-ready Progressive Web App inspired by **Nanoloop** and **Teenage Engineering Pocket Operators**, built for making sunlit **deep house**, **microhouse**, and **Sofia Kourtesis-style** grooves — right in your browser or installed on your phone.

Zero build steps. Zero external audio samples required. 100% Web Audio API + Canvas 1-bit pixel LCD.

## Features

- **8 Patterns (`A`–`H`) + Song Chain**: Ships with 4 starter grooves (*La Perla*, *Break*, *Micro*, *Sunrise*) + 4 sketch slots (`E`–`H`) and an automatic **Song Chain** arranger (`A → A → B → D`) in `≡ Menu`.
- **4 Tactile Pixel Rotary Knobs across 3 Banks** (no fiddly sliders):
  - **`SND` bank** (per track): **`TONE`** (filter warmth / vocal vowel) · **`DECAY`** (tight microhouse stab → blooming pad) · **`SPACE`** (dotted-8th dub tape delay + warm plate reverb) · **`DRIVE`** (4×-oversampled analog overdrive + brickwall compression on every track, including Kick & Perc).
  - **`MIX` bank** (granular mixing): **`VOL`** (0–100% per-track volume, reflected live in each track's orange LED bar) · **`PAN`** (stereo L/R placement) · **`DUST`** (0–100% warm vinyl dust) · **`M.VOL`** (master output volume).
  - **`MSTR` bank** (global groove): **`BPM`** (`110–136`) · **`SWING`** (`0–65%`) · **`PUMP`** (`0–100%` kick sidechain ducking) · **`COMP`** (`0–100%` master bus glue compression & console drive).
- **Minimal Pixel Piano Keyboard (`KEYS` / `P`)**: Swap the 4×4 grid anytime for a multi-touch 15-key chromatic keyboard (`C`–`D+`) with `OCT - / +`, subtle orange scale-guide dots, a 16-step mini ribbon, and polyphonic custom chord capture (recorded chords export cleanly to `.mid` and `.sol16.json`).
- **6 House & Sample Tracks** (`KICK`, `PERC`, `BASS`, `CHORD`, `VOX`, `SMPL`):
  - **Pick & Paint workflow**: Tap any chord, scale note, drum, or chop to preview it, then paint directly onto the 4×4 Nanoloop step grid. Long-press or right-click active steps for ghost notes; tap the orange LED bar under any track to mute/unmute in one tap.
  - **2 Sample Engines**: Load any audio file (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.webm`) via drag-and-drop or file picker, or record straight from your mic — pitched chromatically across the scale on **`VOX`**, or auto-sliced into **8 playable chops (`S1`–`S8`)** on **`SMPL`**.
  - **4 Scale-Locked House Moods**: *Sunset* (F Dorian), *Midnight* (C Minor), *Palma* (D Dorian), and *Velvet* (A Minor) — plus a 1-tap **`+ IDEA`** house groove generator.
- **4 Pocket Operator Punch-In FX**: Hold **`STUTTER`**, **`DUB`**, **`FILTER`**, or **`TAPE`** for live drops and fills.
- **Import & Export**:
  - **`.sol16.json`** — Save and load complete songs (all 8 patterns, Song Chain, knob settings, and embedded custom samples).
  - **`.mid`** — Multi-track Standard MIDI File export for Ableton Live, Logic Pro, FL Studio, or GarageBand.
  - **`.wav`** — Live stereo master audio recording.
- **Mobile-First Offline PWA**: Designed to fit above the fold on smartphones (`360px+`), supports iOS/Android **Add to Home Screen**, and runs offline via Service Worker.

## Run Locally

```bash
npm run dev
```

Open **http://127.0.0.1:4173** (or run `HOST=0.0.0.0 npm run dev` to access from your phone on the same Wi-Fi).

## Deploy to GitHub Pages (Instant HTTPS PWA)

Because SOL-16 has zero build step (and includes `.nojekyll`), you can deploy directly from `main`:

1. Ensure the repository visibility is **Public** (required for GitHub Pages on Free plans).
2. Go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch** → **`main`** → **`/ (root)`** → **Save**.
4. Open your live `https://<username>.github.io/sol-16/` URL on your phone and tap **Add to Home Screen**!

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Stop |
| `R` | Arm Live Step Recording |
| `1` – `6` | Select Track (`Shift + 1–6` to Mute) |
| `A` – `K` | Audition / Live Play Sound Pads |
| `Z` `X` `C` `V` | Hold Punch-In FX (`STUTTER`, `DUB`, `FILTER`, `TAPE`) |
| `G` | Generate fresh groove idea for active track |

## License

MIT — see [LICENSE](LICENSE).
