# GIF Maker

A browser-based GIF editor built with **React + Vite**.  
Upload an animated GIF, add frame-by-frame text overlays, preview the result, and export the edited GIF – all entirely in the browser.

🌐 **Live demo:** https://ispankzombiez.github.io/gif-maker/

---

## Features

| Feature | Details |
|---|---|
| **GIF Upload** | Drag & drop or click-to-browse |
| **Frame Timeline** | Scrollable strip of frame thumbnails |
| **Canvas Editor** | Preview frame with live text overlay |
| **Text Overlay** | Per-frame text, font, size, colour, position |
| **Drag to Position** | Drag text directly on the canvas |
| **Apply to All** | Copy one frame's overlay to every frame |
| **Export GIF** | Re-encodes edited frames with gif.js |
| **Project Save/Load** | Saves state as a `.gifmaker.json` file |
| **Mobile-friendly** | Responsive layout + pointer/touch events |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & run locally

```bash
git clone https://github.com/ispankzombiez/gif-maker.git
cd gif-maker
npm install
npm run dev
```

The dev server starts at `http://localhost:5173/gif-maker/`.

### Build for production

```bash
npm run build
# Output is in the dist/ directory
```

### Preview production build

```bash
npm run preview
```

---

## Deployment (GitHub Pages)

The repo includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that automatically builds and deploys to GitHub Pages on every push to `main`.

To enable it:

1. Go to **Settings → Pages** in your repository.
2. Set **Source** to **GitHub Actions**.
3. Push to `main` – the workflow will handle the rest.

---

## Project Structure

```
gif-maker/
├── index.html
├── vite.config.js
├── package.json
├── public/
│   └── gif.worker.js          # gif.js Web Worker (copied from node_modules)
├── src/
│   ├── main.jsx               # React entry point
│   ├── App.jsx                # Root layout component
│   ├── store/
│   │   └── projectStore.js    # React context state management
│   ├── hooks/
│   │   └── useGifFrames.js    # GIF frame extraction via omggif
│   ├── components/
│   │   ├── Uploader.jsx       # GIF upload (drag & drop)
│   │   ├── Timeline.jsx       # Frame thumbnail strip
│   │   ├── CanvasEditor.jsx   # Canvas renderer + drag-to-position
│   │   ├── TextControls.jsx   # Text/font/colour/position controls
│   │   ├── ExportButton.jsx   # gif.js encoder + download
│   │   └── ProjectIO.jsx      # Save/load project JSON
│   └── styles/
│       └── App.css            # Responsive dark-theme styles
└── .github/
    └── workflows/
        └── deploy.yml         # GitHub Pages deployment workflow
```

---

## Stack

- **Frontend** – React 18, Vite 8
- **GIF parsing** – [omggif](https://github.com/deanm/omggif)
- **GIF encoding** – [gif.js](https://github.com/jnordberg/gif.js)
- **Rendering** – HTML Canvas API
- **State** – React Context + useReducer

---

## License

MIT
