# 3AM — Microhouse 4-Track Tape Loom

A minimal, Berlin 3 AM pixel-art **4-track magnetic tape deck** for crafting deep house and microhouse — combining direct human control (**Tape Ribbons**) with restrained procedural micro-detail (**Anchor & Echo**).

Zero build steps. Zero external audio samples. 100% Web Audio API + crisp pixel Canvas.

## Concept: Anchor & Echo on Magnetic Tape

- **Mint Blocks = Your Anchors:** Solid magnetic splices you tap or paint directly onto each tape (`SUB`, `CUT`, `CHD`, `AIR`). The engine never moves or erases them.
- **Amber Sparks = Procedural Micro-Dust:** Turn up **`MICRO`** to weave quiet micro-clicks, anticipation ghost notes, and dub whispers into the negative space *around* your anchors.
- **Independent Polyrhythmic Reels:** Drag any tape's numbered right **pinch-roller** (`3–16` steps) to run odd loop lengths against a 4/4 pulse (e.g., `SUB 16`, `CUT 11`, `CHD 13`, `AIR 8`).

## Direct Controls on the Pixel Tape Deck

| Zone | Gesture | Action |
| --- | --- | --- |
| **Left Spinning Reel** | Tap | Mute / unmute lane cleanly |
| **Magnetic Tape** | Tap empty / anchor | Place or remove a solid Mint anchor |
| **Active Anchor** | Drag Up / Down | Change bass note, chord voicing, or micro-perc voice |
| **Empty Tape** | Drag Left / Right | Slip that lane's phase ±1 step against the kick |
| **Right Pinch-Roller** | Drag Left / Right | Resize loop length (`3`–`16` steps) |
| **Far-Right `HEAD` Bar** | Drag Up / Down | Sculpt tape-head pressure (filter warmth & level) |

## 4 Macro Knobs (Always Visible)

- **`MICRO`** — Dry anchors (`0%`) ↔ shimmering microhouse dust (`100%`)
- **`DEPTH`** — Tight surface clicks ↔ cavernous Berlin dub delay, sidechain pump & vinyl floor
- **`DRIFT`** — Locked machine groove ↔ human swing, per-hit timbre drift & slow 16-bar filter breathing
- **`BPM`** — `112`–`132` BPM (double-tap any knob to reset)

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Stop |
| `R` | Toggle live **TAP** anchor recording mode |
| `K` | Cycle deep-house key (`F DOR`, `C MIN`, `D DOR`, `A MIN`) |
| `1` – `4` | Mute / Unmute `SUB`, `CUT`, `CHD`, `AIR` |
| `A` `S` `D` `F` | Hold for live **Dub Throw** (or tap anchors when `TAP` is armed) |
| `Shift + A/S/D/F` | Seed a fresh musical anchor skeleton for that single lane |

## Run Locally

```bash
npm run dev
```

Open **http://127.0.0.1:4174** (or run `HOST=0.0.0.0 npm run dev` to play on your phone over Wi-Fi).

## License

MIT — see [LICENSE](LICENSE).
