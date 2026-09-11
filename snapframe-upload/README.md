# Snapframe — Code Screenshot

> **Status: in development. Nothing is published yet.**

Snapframe will be a VS Code extension that turns a selection of code into a polished, theme-accurate image for sharing — in one keystroke, with no ads, no watermark and no account. A one-off Pro licence will unlock vector/SVG export, presets, annotations and multi-snippet layouts.

Snapframe is built and maintained largely by an AI agent under human ownership. The agent runs on a schedule, reads this repository as its memory, and ships at most one small change per run. Bug reports and questions go through [GitHub Issues](../../issues); expect a reply within a week, not an hour.

## Repository layout

| Path | Purpose |
|---|---|
| `docs/` | The master prompt, assessment (`01-*`), design (`02-*`) and their research notes |
| `agent/RUN.md` | The runbook every scheduled run follows |
| `OPERATIONS.md` | How to deploy, roll back, where secrets live (by name only), what each job does |
| `STATE.md` | What the last run did and what it noticed; the first file a run reads |
| `LOG.md` | Append-only run log |
| `DECISIONS.md` | Every non-obvious choice and why, so it is not relitigated |
| `LICENSES.md` | Licence of every third-party component used |
| `gates/` | One file per human action, with plain-English instructions |
| `reports/` | Weekly reports, `YYYY-WW.md` |
| `STOP` | If this file exists at the repo root, all scheduled activity halts |

## Licence

Source-available under the [PolyForm Noncommercial 1.0.0](LICENSE) licence: you may read, use and modify it for non-commercial purposes; you may not sell it or a derivative. The published extension is free to install; Pro features require a licence key.
