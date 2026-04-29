# gif-maker

Draft plan for a small web app that edits GIFs with frame-by-frame text placement.

## Goal
Build a browser-based app where a user can:
- upload a GIF
- add text overlays
- move text position on each frame
- preview the result
- export the edited GIF

## Initial MVP
- GIF upload
- frame extraction / timeline viewer
- add text overlay
- per-frame text position controls
- export GIF
- simple project state save/load as JSON

## Suggested stack
- Frontend: React + Vite
- Rendering: HTML Canvas
- GIF processing: ffmpeg.wasm or gif.js
- State: local JSON project file

## Notes
- Keep the first version focused on a single text layer
- Make frame-by-frame editing easy before adding more effects
- Optimize for GitHub Pages deployment
