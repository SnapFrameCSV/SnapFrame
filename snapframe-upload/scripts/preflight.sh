#!/usr/bin/env bash
# Preflight for every scheduled run. Exit 0 with "STOP present" if the kill switch is set.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f STOP ]; then
  echo "STOP present — exiting without doing anything."
  exit 0
fi
echo "STOP absent. Branch: $(git rev-parse --abbrev-ref HEAD). Last commit: $(git log -1 --format='%h %s')"
echo "--- STATE.md (first 40 lines) ---"
head -40 STATE.md
