# Changelog

All notable changes to Snapframe are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.0.1] — unreleased

### Added
- Extension skeleton: command entries, settings schema, esbuild bundle, `node:test` suite and CI.
- **Capture Selection**: selection or whole file, with your editor's real theme and font; de-indents, expands tabs and soft-wraps; live preview with background, padding, shadow, corner radius, window dots, title bar and line numbers; Export PNG at 1×/2× to a folder or a save dialog, optionally copying the image to the clipboard.
- **Quick Snap**: capture and export with your current settings in one keystroke, no preview.
- **Enter Licence Key**: paste a Pro key; it is verified offline on your machine (Ed25519 signature, no network) and kept in VS Code's secret storage; a "Snapframe Pro" status-bar item shows while a key is active. Keys cannot be activated until the release build carries the public key.
- Buy Pro still reports that it is not available in this preview build.
- Pro: **Export SVG** from the preview — the frame as a standalone vector file.
- Pro: **Export WebP** and **Export PDF** (lossless, one page sized to the frame), a **transparent** background type, and **3×/4×** export scale. Without a key these settings fall back to their free equivalents; nothing free changes.
- Pro: **Presets** — save the current frame settings under a name, apply or delete them from a quick pick, and export/import them as a JSON file to share.
- Pro: **Custom gradients** (any angle, up to 8 colour stops), a **background image** behind the frame, and a **caption or handle** under it in your brand colour.
- Pro: **Line highlighting** (`snapframe.highlightLines`, e.g. `"12-14, 20"`), **focus-dim** to fade the other lines, and **callouts** — short labels pinned to a line.
- Pro: a **QR code** under the frame from `snapframe.qr.text` (your repo, gist or docs link), generated on your machine as crisp vector squares.
- Pro: **Before/after comparisons** — *Capture as 'Before'*, then *Capture as 'After' and Compare* renders both snippets in one image, side by side or stacked, with labels you can change.
- Pro: **Capture Terminal Selection** — frame text selected in the integrated terminal, titled with the terminal's name.
- Pro: **Export All Selections** (one image per multi-cursor selection) and **Export All Open Editors** straight into your export folder, and an option to **copy a Markdown image link** after every export.
