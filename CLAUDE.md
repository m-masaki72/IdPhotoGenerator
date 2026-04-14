# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development

```bash
npm run dev          # Serve locally on port 3000
npx serve . -p 3000  # Alternative
```

**Note:** Background removal (via SharedArrayBuffer) requires COOP/COEP headers. These are set in `_headers` for Cloudflare Pages. Locally, Chrome must be launched with `--enable-features=SharedArrayBuffer` or use a local server that sets the required headers.

## Architecture

Single-file SPA: all logic lives in `index.html` (~1080 lines). No build step — static HTML/CSS/JS deployed directly.

### State

Central `state` object (line ~603) holds:
- `slots[0..5]`: per-image data (original blob, processed blob, transform: scale/x/y)
- `bgColor`, `layout` (3x2 or 2x3), `borderStyle`
- `bgRemover`: lazily loaded `@imgly/background-removal` module
- `bgRemoveEnabled`, `currentEditSlot`

### Flow

1. **Upload** → 6 image slots, drag-and-drop or file picker
2. **Background removal** → optional, dynamically imports `@imgly/background-removal@1.5.5` from CDN on first use
3. **Edit** → interactive canvas per slot (drag to reposition, slider to scale)
4. **Preview** → real-time grid using CSS/canvas
5. **Generate** → renders high-res PNG (400px cells, 2× device scale) via `<canvas>`
6. **Download/Share** → save PNG or post to X (Twitter)

### Key Sections in index.html

| Lines    | Module                          |
|----------|---------------------------------|
| 603–637  | State + DOM refs                |
| 639–726  | Upload system                   |
| 728–785  | Background removal + progress   |
| 788–808  | Step navigation                 |
| 838–871  | Preview rendering               |
| 873–970  | Image editor (canvas drag/scale)|
| 972–1043 | Final generation                |
| 1045–1072| Download, share, toast          |

### Dependencies

- `@imgly/background-removal@1.5.5` — loaded from CDN at runtime (AGPL-3.0)
- Google Fonts (Zen Maru Gothic, M PLUS Rounded 1c)

## Deployment

Deploy to Cloudflare Pages. The `_headers` file sets `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` required for SharedArrayBuffer (used by the background removal library).
