# Snapframe — Code Screenshot

Turn a code selection into a clean, shareable PNG in one keystroke. The image keeps your editor's real theme, font and ligatures, fixes indentation and wraps long lines — the two things people complain about most in the tools that came before.

> **Preview build.** Version 0.0.1 has the free capture, preview and PNG export working and the licence-key command wired up; no keys can be issued yet and Buy Pro tells you it is not available. Watch the [changelog](CHANGELOG.md).

## How it works

1. Select some code (or nothing, for the whole file).
2. Run **Snapframe: Capture Selection** — `Ctrl+Alt+Shift+S` (`Cmd+Alt+Shift+S` on macOS), the command palette, or the editor's right-click menu.
3. Adjust the frame in the live preview and save the PNG, or copy the image straight to the clipboard.

**Snapframe: Quick Snap** repeats your last settings with no preview.

## Free vs Pro

Pro is strictly additive. The free tier never gets a watermark, an advert, a nag or a sign-in, and nothing that is free today will move behind the paywall.

| Free (forever, no watermark, no ads, no account) | Pro (one-off US$9 key) |
|---|---|
| Capture selection or whole file with your actual theme, font and ligatures | SVG (vector), PDF and WebP export; transparent backgrounds; 3×/4× scale |
| Correct de-indentation and soft-wrap | Named presets, saved and shareable as JSON |
| Window chrome, padding, background colour, shadow, rounded corners, optional line numbers and title bar | Custom gradients/background images, brand colour, your own caption or handle |
| Export PNG to file **and copy the image to the clipboard**, 1× and 2× | Line highlighting, focus-dim ranges, inline annotations and callouts |
| One-command "quick snap" with last settings; keyboard shortcut | Before/after and side-by-side layouts; terminal-selection capture |
| Works in VS Code, Cursor, Windsurf, VSCodium | Batch export of all selections / open editors; "copy as Markdown image link" |

A Pro key is a one-time purchase, works on up to three machines and is verified offline — no account, no sign-in, no phone-home.

## Privacy

Snapframe makes **no network requests** and collects **nothing**. It reads only the text you select, only when you run a command, and writes only the image file you ask for. The single exception is **Snapframe: Buy Pro…**, which opens a checkout page in your browser and sends nothing from the editor. The extension declares no telemetry (see `telemetry.json`).

## Support

Bugs, questions and feature requests go to [GitHub Issues](https://github.com/SnapFrameCSV/snapframe/issues). Every issue gets a reply within a week.

## About

Snapframe is built and maintained largely by an AI agent under human ownership. The source is public and source-available (see the [licence](https://github.com/SnapFrameCSV/snapframe/blob/main/LICENSE)); you can read every line, including how the Pro check works.
