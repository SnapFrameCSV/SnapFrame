# Changelog

All notable changes to Snapframe are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.0.1] — unreleased

### Added
- Extension skeleton: command entries, settings schema, esbuild bundle, `node:test` suite and CI.
- **Capture Selection**: selection or whole file, with your editor's real theme and font; de-indents, expands tabs and soft-wraps; live preview with background, padding, shadow, corner radius, window dots, title bar and line numbers; Export PNG at 1×/2× to a folder or a save dialog, optionally copying the image to the clipboard.
- **Quick Snap**: capture and export with your current settings in one keystroke, no preview.
- **Enter Licence Key**: paste a Pro key; it is verified offline on your machine (Ed25519 signature, no network) and kept in VS Code's secret storage; a "Snapframe Pro" status-bar item shows while a key is active. Keys cannot be activated until the release build carries the public key.
- Buy Pro still reports that it is not available in this preview build.
