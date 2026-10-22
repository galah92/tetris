# Tetris

A fast, beautiful, offline-ready Tetris for phones, tablets and desktop. Plain HTML/CSS/JS with no dependencies and no build step (~50 KB).

**Play:** https://galah92.github.io/tetris/

## Features
- Modes: Marathon, Sprint (40 lines), Ultra (2 minutes) and Zen (no game over)
- Modern guideline gameplay: SRS rotation with wall kicks, optional 180° rotation, 7-bag, hold, 5-piece preview, ghost piece, lock delay
- Scoring with T-spins, back-to-back, combos and perfect clears
- Touch gestures (drag to move, tap to rotate, flick down to drop, flick up to hold) plus optional on-screen buttons
- Tunable touch sensitivity, DAS/ARR and starting level
- Five themes: Midnight, Paper, Neon, Graphite, Retro
- Local top-10 per mode and lifetime stats
- Pixel-perfect layout that adapts to any screen and orientation, with safe-area support for notched phones
- Installable PWA that works offline, with a one-tap refresh when a new version ships
- Synthesized sound effects and optional generative ambient music (no audio files)

## Controls
| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | ← → | Drag sideways |
| Soft drop | ↓ | Drag down |
| Hard drop | Space | Flick down |
| Rotate ↻ / ↺ | ↑ or X / Z | Tap right / left half |
| Rotate 180° | A | Two-finger tap (enable in Settings) |
| Hold | C or Shift | Flick up |
| Pause | Esc or P | Pause button |

## Run locally
Any static server works, e.g. `npx serve .`

## Deploy
Every push to `main` runs `.github/workflows/deploy.yml`, which stamps the service worker version and publishes to the `gh-pages` branch.
