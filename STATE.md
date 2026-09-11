# STATE

**Read this first on every run. Update it before every run ends.**

## Current phase
Phase 3 — Build. Step 5.0 (loop proof) is **not** complete: no scheduled run has yet landed a commit on `main`. Next: resolve the push path (see "Blocked on"), then step 5.1 (`agent/BUILD.md` Slice 1). No product code exists yet, by design.

## Blocked on
**Push to `main`.** The scheduled run's environment binds each session to a working branch (this session: `claude/keen-knuth-m1envd`) and its rules forbid pushing to any other branch. Every run so far has therefore pushed to that branch, not to `main` — `origin/main` still holds only the operator's upload commit `Initial project files`, and there are no pull requests. The previous run's note "pushed to `main`" was wrong; corrected this run. D12 (runs push straight to `main`) cannot be honoured until the routine is configured to allow it, or the operator accepts a branch-then-merge flow. The operator needs to decide; options are in "Open questions".

## Last run
- 2026-09-11 (scheduled routine, run 2): Did the one-time repair from `agent/ROUTINE-PROMPT.md` step 0 — moved everything out of `snapframe-upload/` to the repository root and removed the stray top-level duplicates (`01-*.md`, `02-*.md`, `gates/`). Removed `scripts/ci-workflow.yml` (identical to `.github/workflows/ci.yml`, and its text tripped CI's own secret-pattern check). Ran CI's hygiene checks locally: green. Diagnostics: `npm view esbuild version` → 0.28.2; `GET api.github.com/repos/SnapFrameCSV/snapframe` → 200. Discovered and recorded that pushes go to the session branch, not `main`. Pushed to `claude/keen-knuth-m1envd`.

## Next run should
1. Check for `STOP`.
2. Check whether `origin/main` now contains this run's commits (`git log origin/main --oneline`). If yes, the push path is resolved: tick that in `gates/gate-02b-upload-and-schedule.md`, set "Blocked on" to nothing, and start step 5.1 (Slice 1 in `agent/BUILD.md`).
3. If not, do not build product code on a branch nobody merges. Do "when blocked" work only (`agent/RUN.md` §5), keep pushing to the session branch, and repeat the ask in the next weekly report (at most once per 7 days).

## Open questions for the operator
One decision, plain English: the daily run can write to the repository but is only allowed to write to a side branch, not the main branch. Either
(a) in the Claude app, open the routine "Snapframe operate loop" and check whether its settings allow the run to push to `main` (if there is such an option, enable it); or
(b) accept that each run pushes to a side branch and you merge it on GitHub with one click — but that means the loop is no longer unattended, which is what D12 was trying to avoid.
Reply with "a" or "b". Until then the run does maintenance only.

## Stuck on
Nothing yet (this is the first run to see the push constraint; three repeats trigger the BUILD.md stuck rule).

## Metrics
Not applicable yet (nothing published).
