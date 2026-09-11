# STATE

**Read this first on every run. Update it before every run ends.**

## Current phase
Phase 3 — Build, step 5.0 (prove the operating loop). No product code exists yet, by design.

## Blocked on
**BLOCKED ON gate-02b** — the operator uploads this folder to the repository through GitHub's web page and creates the scheduled routine with the repository selected. See `gates/gate-02b-upload-and-schedule.md`. If you are reading this file inside a routine run, gate-02b is cleared: tick its checkbox.

## Last run
- 2026-09-11 (interactive Cowork session, Sydney): Gates 0, 1 and 2 cleared (GitHub linked as `SnapFrameCSV`). A routine created *from the interactive session* ran but could not reach the repository — the interactive session and anything it schedules are not bound to any repository (GitHub answers "GitHub access to this repository is not enabled for this session"). Routines created in the Claude app with the repository selected are bound. Hence gate-02b.

## Next run should
1. Check for `STOP`.
2. Loop-proof mode (see `agent/RUN.md`): tick gate-02b, append "loop proof run OK" to `LOG.md`, update this file (mark step 5.0 done), push to `main`, finish with `LOOP PROVEN:` plus diagnostics. If the push to `main` is rejected, push to `claude/run` and fast-forward `main` via the GitHub merge API (`POST /repos/SnapFrameCSV/snapframe/merges`); record which worked in `DECISIONS.md`.
3. Record in `OPERATIONS.md` whether `npm view esbuild version` worked in the routine environment.
   - If `.github/workflows/ci.yml` is missing (the web upload may skip the dot-folder, and the desktop bridge cannot write it), copy `scripts/ci-workflow.yml` to `.github/workflows/ci.yml` in the same commit.
4. Then step 5.1: extension skeleton with CI (`extension/`), then the Worker (`worker/`). Everything customer-facing waits for gates 3–5.

## Open questions for the operator
None beyond gate-02b.

## Metrics
Not applicable yet (nothing published).
