# STATE

**Read this first on every run. Update it before every run ends.**

## Current phase
Phase 3 — Build, step 5.0 done (operating loop proven: scheduled runs reach the repository and push to `main`). Next: step 5.1 (`agent/BUILD.md` Slice 1). No product code exists yet, by design.

## Blocked on
Nothing.

## Last run
- 2026-09-11 (scheduled routine, run 2): Did the one-time repair from `agent/ROUTINE-PROMPT.md` step 0 — moved everything out of `snapframe-upload/` to the repository root and removed the stray top-level duplicates (`01-*.md`, `02-*.md`, `gates/`). Removed `scripts/ci-workflow.yml` (identical to `.github/workflows/ci.yml`; its own grep pattern tripped CI's secret check). Added D14 (build budget). CI hygiene checks green locally. **Mistake, corrected within the run:** an aborted multi-ref `git fetch` left a stale view of `origin/main`, so this run briefly believed run 1's push had never reached `main`, wrote that into the record, pushed it to the session branch and sent a "LOOP NOT PROVEN" notification. A direct `git ls-remote` disproved it minutes later: `main` already carried run 1's commits. Record corrected in this commit, D15 withdrawn, correction notification sent, lesson in `OPERATIONS.md`. Pushed to `main`. Diagnostics: `npm view esbuild version` → 0.28.2; `GET api.github.com/repos/SnapFrameCSV/snapframe` → 200.

## Next run should
1. Check for `STOP`.
2. Confirm the CI run on `main` for this run's commits is green (`repo-hygiene` job). If red, fix it first (`agent/RUN.md` §3 item 1).
3. Start step 5.1: `agent/BUILD.md` Slice 1 — `extension/` skeleton (package.json with commands and settings, TypeScript bundled by esbuild, `node:test` smoke test, `README.md`/`CHANGELOG.md`/`telemetry.json`, icon script) plus the `extension` CI job. Record dev dependencies in `LICENSES.md` before adding them. If it does not fit in one run, land the smallest green sub-step and write the exact next sub-step here.
4. Then the Worker (`worker/`, Slice 5). Everything customer-facing (publishing, payments, going live) still waits for gates 3–5 — no deviation from `docs/02-design.md` without a cleared gate.

## Open questions for the operator
None. (Ignore the "LOOP NOT PROVEN" notification from this run's first attempt; the follow-up notification is the correct one.)

## Metrics
Not applicable yet (nothing published).
