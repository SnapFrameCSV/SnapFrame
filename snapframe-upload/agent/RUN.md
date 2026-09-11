# RUN.md — the runbook for every scheduled run

Budget: **10 minutes** of work, **one** deploy, **zero** questions to the operator unless a gate is genuinely the only remaining blocker. Plan the run before touching anything.

## 0. Preflight (always, in this order)

1. `test -f STOP && echo "STOP present — exiting" && exit 0`
2. Read `STATE.md`, then `OPERATIONS.md`, then `DECISIONS.md` (skim), then the last 20 lines of `LOG.md`.
3. Decide the single most valuable thing this run can do, given "Blocked on" and "Next run should" in `STATE.md`. Write that plan in one line into your working notes before starting.

## 1. Gate check

- For each unchecked gate file in `gates/`, check whether the operator's action has taken effect (e.g. can you push? does the secret exist by name in the workflow run logs? is the Stripe account ID recorded?). If yes: tick the checkbox in the gate file, note it in `DECISIONS.md` if it changed anything, and unblock.
- If a gate is still open and it is the only blocker: do "When blocked" work (§5). Remind the operator at most once per 7 days, and only in the weekly report.

## 2. Metrics (once anything is published)

- Read `metrics/marketplace.json` (written by the daily Action) and the Worker's `/stats` JSON (aggregate counts only).
- Compare against the thresholds in `docs/02-design.md` §8. If any threshold is crossed, this run's improvement is cancelled: write the early report (§6) and flag it.

## 3. Queue

In this priority order, and only as far as the budget allows:
1. Failed CI / failed deploy on `main` → fix or `git revert`. Same failure three runs in a row → stop retrying, disable the affected feature if safe, escalate in the report.
2. Reconciliation: any paid Stripe session without an issued key → mint via the Worker's admin path (once it exists) and log it.
3. Open Issues: reproducible crash or wrong output first; label and batch feature requests; lock abuse. Reply with facts, never argue, never promise dates beyond "next weekly run".
4. Dependabot: merge patch/minor on green; majors are a planned change with a `LICENSES.md` check.

## 4. One improvement

Pick **one** small change with the highest expected effect on the design's five metrics. Never a redesign, never a new stream, never a Pro feature moved behind a paywall that was free before (D05). Write tests first for anything touching licence verification or key issuance.

## 5. When blocked (useful non-blocked work)

- Improve docs, tests, or the golden-image suite.
- Research for the fallback (Adobe Stock pipeline) into `docs/fallback/` — research only, no accounts, no uploads.
- Tidy `OPERATIONS.md` if you learned something this run.

## 6. Ship and record (always)

1. Run tests. Deploy only if green, and only one deploy.
2. Update `STATE.md`: phase, blocked-on, last run, next run should, open questions, metrics.
3. Append one line to `LOG.md`.
4. If today is Sunday (Sydney) or a threshold was crossed or a gate is needed: write `reports/YYYY-WW.md` (<200 words: revenue this week and cumulative, the five metrics, what you did that the operator should know, what you need from them — ideally nothing — and the verdict **keep / watch / pivot / kill**).
5. Commit with a plain-English message and push to `main`.
6. End the run with the report text (or a two-line summary on non-report days) as your final message — the run-completion notification carries it to the operator.

## Loop-proof mode (until `STATE.md` says step 5.0 is done)

If the repo has no `extension/` folder yet, the whole run is: preflight → append `LOG.md` line "loop proof run OK" → update `STATE.md` → push → final message "Loop proof: cloned, committed, pushed. Ready for step 5.1." If the push fails, the final message must say exactly why (e.g. "No linked GitHub account") so the operator knows gate-02 is still open.
