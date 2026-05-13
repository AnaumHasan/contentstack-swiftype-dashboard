#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fetchSwiftypeAnalytics,
  mergeSearchAnalytics,
  normalizeAnalyticsRows
} from './swiftypeClient.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith('--') ? next : true;
    if (args[key] === next) index += 1;
  }
  return args;
}

function getDefaultRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

async function loadDotEnv() {
  const envPath = path.join(rootDir, '.env');
  try {
    const text = await fs.readFile(envPath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

async function updateArchiveIndex() {
  const archiveDir = path.join(rootDir, 'public/data/archive');
  const entries = await fs.readdir(archiveDir).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });

  const ranges = entries
    .filter((entry) => /^swiftype-search-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/.test(entry))
    .map((entry) => {
      const [, startDate, endDate] = entry.match(/^swiftype-search-(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.json$/);
      return {
        startDate,
        endDate,
        label: `${startDate} to ${endDate}`,
        url: `/data/archive/${entry}`
      };
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  await writeJson(path.join(rootDir, 'public/data/index.json'), {
    generatedAt: new Date().toISOString(),
    ranges
  });
}

async function main() {
  await loadDotEnv();

  const args = parseArgs(process.argv.slice(2));
  const defaults = getDefaultRange();
  const startDate = args.start || args.start_date || process.env.SWIFTYPE_START_DATE || defaults.startDate;
  const endDate = args.end || args.end_date || process.env.SWIFTYPE_END_DATE || defaults.endDate;
  const perPage = Number(args['per-page'] || args.per_page || process.env.SWIFTYPE_PER_PAGE || 100);
  const engine = args.engine || process.env.SWIFTYPE_ENGINE || 'contentstack-documentation';
  const baseUrl = args['base-url'] || process.env.SWIFTYPE_BASE_URL || 'https://api.swiftype.com/api/v1';
  const authToken = args.token || process.env.SWIFTYPE_AUTH_TOKEN;
  const outFile = path.resolve(rootDir, args.out || 'public/data/swiftype-search.json');

  const [topQueriesPayload, noResultPayload] = await Promise.all([
    fetchSwiftypeAnalytics({ endpoint: 'top_queries', authToken, engine, startDate, endDate, perPage, baseUrl }),
    fetchSwiftypeAnalytics({ endpoint: 'top_no_result_queries', authToken, engine, startDate, endDate, perPage, baseUrl })
  ]);

  const topQueries = normalizeAnalyticsRows(topQueriesPayload);
  const noResultQueries = normalizeAnalyticsRows(noResultPayload);
  const combined = mergeSearchAnalytics(topQueries, noResultQueries);

  const report = {
    generatedAt: new Date().toISOString(),
    source: { engine, startDate, endDate, perPage },
    summary: {
      totalTrackedQueries: combined.length,
      totalSearches: topQueries.reduce((sum, row) => sum + row.count, 0),
      totalNoResults: noResultQueries.reduce((sum, row) => sum + row.count, 0),
      queriesNeedingReview: combined.filter((row) => row.noResults > 0).length
    },
    topQueries,
    noResultQueries,
    combined
  };

  await writeJson(outFile, report);

  const archiveName = `swiftype-search-${startDate}_${endDate}.json`;
  await writeJson(path.join(rootDir, 'public/data/archive', archiveName), report);
  await updateArchiveIndex();

  console.log(`Wrote ${path.relative(rootDir, outFile)}`);
  console.log(`Tracked ${combined.length} queries from ${startDate} to ${endDate}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
