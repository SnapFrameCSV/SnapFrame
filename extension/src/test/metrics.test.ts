import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The metrics script is an ES module outside this package; TypeScript would
// rewrite a static import() to require() under CommonJS, so load it
// dynamically through the runtime's own import.
const scriptUrl = pathToFileURL(path.resolve(__dirname, '..', '..', '..', 'scripts', 'marketplace-metrics.mjs')).href;
const loadScript = new Function('url', 'return import(url)') as (url: string) => Promise<{
  parseExtensionQuery: (json: unknown, id: string, fetchedAt?: string) => Record<string, unknown>;
  extensionQueryBody: (id: string) => { filters: Array<{ criteria: Array<{ filterType: number; value: string }> }>; flags: number };
  fetchMetrics: (id: string, fetchImpl: unknown) => Promise<Record<string, unknown>>;
  EXTENSION_QUERY_URL: string;
}>;

// The shape `vsce show` reads (results[0].extensions[].statistics[]).
const fixture = {
  results: [
    {
      extensions: [
        {
          publisher: { publisherName: 'snapframe' },
          extensionName: 'snapframe',
          lastUpdated: '2026-10-01T00:00:00.000Z',
          versions: [{ version: '0.1.0' }],
          statistics: [
            { statisticName: 'install', value: 1234 },
            { statisticName: 'averagerating', value: 4.5 },
            { statisticName: 'ratingcount', value: 12 },
            { statisticName: 'updateCount', value: 300 },
            { statisticName: 'downloadCount', value: 1600 },
            { statisticName: 'trendingdaily', value: 0.2 },
          ],
        },
      ],
    },
  ],
};

test('parseExtensionQuery extracts the five numbers the design tracks', async () => {
  const { parseExtensionQuery } = await loadScript(scriptUrl);
  const snapshot = parseExtensionQuery(fixture, 'snapframe.snapframe', '2026-10-02T00:00:00.000Z');
  assert.deepEqual(snapshot, {
    fetchedAt: '2026-10-02T00:00:00.000Z',
    extensionId: 'snapframe.snapframe',
    found: true,
    version: '0.1.0',
    lastUpdated: '2026-10-01T00:00:00.000Z',
    installs: 1234,
    averageRating: 4.5,
    ratingCount: 12,
    updateCount: 300,
    downloadCount: 1600,
  });
});

test('parseExtensionQuery reports found:false before first publish and survives odd shapes', async () => {
  const { parseExtensionQuery } = await loadScript(scriptUrl);
  assert.deepEqual(parseExtensionQuery({ results: [{ extensions: [] }] }, 'snapframe.snapframe', 't'), { fetchedAt: 't', extensionId: 'snapframe.snapframe', found: false });
  assert.equal(parseExtensionQuery({}, 'x.y', 't').found, false);
  assert.equal(parseExtensionQuery(null, 'x.y', 't').found, false);
  const sparse = parseExtensionQuery({ results: [{ extensions: [{ extensionName: 'snapframe', publisher: { publisherName: 'snapframe' } }] }] }, 'snapframe.snapframe', 't');
  assert.equal(sparse.found, true);
  assert.equal(sparse.installs, 0);
  assert.equal(sparse.averageRating, null);
});

test('fetchMetrics posts the vsce-style query and parses the answer', async () => {
  const { fetchMetrics, EXTENSION_QUERY_URL } = await loadScript(scriptUrl);
  let seen: { url: string; body: unknown; accept: string | null } | undefined;
  const fakeFetch = async (url: string, init: { body: string; headers: Record<string, string> }) => {
    seen = { url, body: JSON.parse(init.body), accept: init.headers.accept };
    return { ok: true, status: 200, json: async () => fixture };
  };
  const snapshot = await fetchMetrics('snapframe.snapframe', fakeFetch);
  assert.equal(seen?.url, EXTENSION_QUERY_URL);
  assert.equal(seen?.accept, 'application/json;api-version=3.0-preview.1');
  assert.deepEqual((seen?.body as { filters: Array<{ criteria: Array<{ filterType: number; value: string }> }> }).filters[0].criteria, [{ filterType: 7, value: 'snapframe.snapframe' }]);
  assert.equal(snapshot.installs, 1234);
  await assert.rejects(fetchMetrics('snapframe.snapframe', async () => ({ ok: false, status: 403 })), /403/);
});
