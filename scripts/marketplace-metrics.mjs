// Fetches the VS Code Marketplace's public statistics for one extension via
// the same extensionquery call `vsce show` makes, and writes a small JSON
// snapshot. No auth, no token. Usage:
//   node scripts/marketplace-metrics.mjs <publisher.name> <output.json>
// Exported functions are tested from extension/src/test/metrics.test.ts.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXTENSION_QUERY_URL = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
// IncludeFiles | IncludeVersionProperties | IncludeAssetUri | IncludeStatistics | IncludeLatestVersionOnly
const QUERY_FLAGS = 2 | 16 | 128 | 256 | 512;
const STATISTICS = ['install', 'averagerating', 'ratingcount', 'updateCount', 'downloadCount', 'weightedRating'];

export function extensionQueryBody(extensionId) {
  return { filters: [{ criteria: [{ filterType: 7, value: extensionId }], pageNumber: 1, pageSize: 1 }], flags: QUERY_FLAGS };
}

/** Pulls the numbers out of an extensionquery response; tolerant of shape drift (every field optional). */
export function parseExtensionQuery(json, extensionId, fetchedAt = new Date().toISOString()) {
  const extensions = json?.results?.[0]?.extensions ?? [];
  const wanted = extensionId.toLowerCase();
  const extension = extensions.find((e) => `${e?.publisher?.publisherName ?? ''}.${e?.extensionName ?? ''}`.toLowerCase() === wanted) ?? extensions[0];
  if (!extension) {
    return { fetchedAt, extensionId, found: false };
  }
  const stats = {};
  for (const entry of extension.statistics ?? []) {
    if (STATISTICS.includes(entry?.statisticName) && typeof entry.value === 'number') {
      stats[entry.statisticName] = entry.value;
    }
  }
  return {
    fetchedAt,
    extensionId,
    found: true,
    version: extension.versions?.[0]?.version ?? null,
    lastUpdated: extension.lastUpdated ?? null,
    installs: stats.install ?? 0,
    averageRating: stats.averagerating ?? null,
    ratingCount: stats.ratingcount ?? 0,
    updateCount: stats.updateCount ?? 0,
    downloadCount: stats.downloadCount ?? 0,
  };
}

export async function fetchMetrics(extensionId, fetchImpl = fetch) {
  const response = await fetchImpl(EXTENSION_QUERY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json;api-version=3.0-preview.1' },
    body: JSON.stringify(extensionQueryBody(extensionId)),
  });
  if (!response.ok) {
    throw new Error(`extensionquery returned ${response.status}`);
  }
  return parseExtensionQuery(await response.json(), extensionId);
}

async function main() {
  const [extensionId, output] = process.argv.slice(2);
  if (!extensionId || !output) {
    console.error('usage: marketplace-metrics.mjs <publisher.name> <output.json>');
    process.exit(2);
  }
  let snapshot;
  try {
    snapshot = await fetchMetrics(extensionId);
  } catch (error) {
    // Before first publish (or on a Marketplace hiccup) keep the last snapshot rather than failing the job.
    console.warn(`Could not fetch statistics: ${String(error)}`);
    try {
      const previous = JSON.parse(await readFile(output, 'utf8'));
      console.warn('Keeping the previous snapshot.');
      snapshot = { ...previous, lastAttempt: new Date().toISOString(), lastError: String(error) };
    } catch {
      snapshot = { fetchedAt: new Date().toISOString(), extensionId, found: false, lastError: String(error) };
    }
  }
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(JSON.stringify(snapshot));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
