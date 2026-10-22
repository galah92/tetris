# Tetris

A fast, beautiful, offline-ready Tetris for phones, tablets and desktop. Plain HTML/CSS/JS with no dependencies and no build step (~50 KB).

**Play:** https://galah92.github.io/tetris/

## Features
- Modern guideline gameplay: SRS rotation with wall kicks, 7-bag, hold, 5-piece preview, ghost piece, lock delay
- Scoring with T-spins, back-to-back, combos and perfect clears
- Touch gestures (drag to move, tap to rotate, flick down to drop, flick up to hold) plus optional on-screen buttons
- Pixel-perfect layout that adapts to any screen and orientation, with safe-area support for notched phones
- Installable PWA that works offline; synthesized sound effects (no audio files)

## Controls
| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | ← → | Drag sideways |
| Soft drop | ↓ | Drag down |
| Hard drop | Space | Flick down |
| Rotate ↻ / ↺ | ↑ or X / Z | Tap right / left half |
| Hold | C or Shift | Flick up |
| Pause | Esc or P | Pause button |

## Run locally
Any static server works, e.g. `npx serve .`
