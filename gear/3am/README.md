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

## Night-Arc Mood Shifter (`01:00` – `07:00`)

Shift the harmonic color, synth timbre, and dub space of your track in one tap without touching your anchors:

- **`01:00 WARM`** — Soulful deep house (warm Rhodes bell tines, Dorian `m9 / M9 / 13` chords, punchy 909 kick)
- **`03:00 MICRO`** — Berlin 3 AM microhouse (tight woody clicks, dark `m9 / m11` dub stabs)
- **`05:00 ABYSS`** — Hypnotic 5 AM dub abyss (Phrygian tension chords, heavy sub weight, dark tape feedback & grit)
- **`07:00 DAWN`** — Afterhours morning light (lifted `M9 / 6/9 / add9` shimmer, airy stereo highs)

## 4 Macro Knobs (Always Visible)

- **`MICRO`** — Dry anchors (`0%`) ↔ shimmering microhouse dust (`100%`)
- **`DEPTH`** — Tight surface clicks ↔ cavernous Berlin dub delay, sidechain pump & vinyl floor
- **`DRIFT`** — Locked machine groove ↔ human swing, per-hit timbre drift & slow 16-bar filter breathing
- **`BPM`** — `112`–`132` BPM (double-tap any knob to reset)

## Master Punch-In Tape FX (Hold to Perform)

- **`WASH`** (`Z`) — Stereo dub tape echo flood
- **`SUBM`** (`X`) — Submerge underwater resonant club filter
- **`FLUT`** (`C`) — Tape brake & cassette pitch flutter
- **`SLICE`** (`V`) — Microhouse 32nd-note rhythmic tape gate

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Stop |
| `R` | Toggle live **TAP** anchor recording mode |
| `H` | Cycle Night-Arc Mood Hour (`01:00`–`07:00`) |
| `K` | Cycle root key (`F`, `C`, `D`, `A`, `G`, `Eb`) |
| `1` – `4` | Mute / Unmute `SUB`, `CUT`, `CHD`, `AIR` |
| `A` `S` `D` `F` | Hold for single-lane **Dub Throw** (or tap anchors when `TAP` is armed) |
| `Shift + A/S/D/F` | Seed a fresh musical anchor skeleton for that single lane |
| `Z` `X` `C` `V` | Hold Master Punch-In Tape FX (`WASH`, `SUBM`, `FLUT`, `SLICE`) |

## Run Locally

```bash
npm run dev
```

Open **http://127.0.0.1:4174** (or run `HOST=0.0.0.0 npm run dev` to play on your phone over Wi-Fi).

## License

MIT — see [LICENSE](LICENSE).
