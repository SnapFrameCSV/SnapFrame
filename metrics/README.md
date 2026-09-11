# metrics/

`marketplace.json` is written daily by `.github/workflows/metrics.yml` from the VS Code Marketplace's public statistics (installs, average rating, rating count, update and download counts) — no login, no token. Scheduled runs read it for the weekly report and the thresholds in `docs/02-design.md` §8. Before the first publish the file says `"found": false`.

The Worker's `/stats` (keys issued/revoked, counts only) is the other metrics source; runs fetch it live.
