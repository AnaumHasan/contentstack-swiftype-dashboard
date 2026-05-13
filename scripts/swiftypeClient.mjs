import http from 'node:http';
import https from 'node:https';

const DEFAULT_BASE_URL = 'https://api.swiftype.com/api/v1';

export function normalizeAnalyticsRows(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.queries || payload?.results || payload?.records || payload?.data || [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      if (typeof row === 'string') {
        return { query: row, count: 0 };
      }

      if (Array.isArray(row)) {
        const [query, count = 0] = row;
        return {
          query: String(query || '').trim(),
          count: Number.isFinite(Number(count)) ? Number(count) : 0,
          raw: row
        };
      }

      const query = row.query || row.term || row.key || row.value || row.search_term || '';
      const count = Number(row.count ?? row.total ?? row.searches ?? row.clicks ?? row.value ?? 0);
      const raw = { ...row };

      return {
        query: String(query).trim(),
        count: Number.isFinite(count) ? count : 0,
        raw
      };
    })
    .filter((row) => row.query);
}

export async function fetchSwiftypeAnalytics({
  endpoint,
  authToken,
  engine,
  startDate,
  endDate,
  perPage = 100,
  baseUrl = DEFAULT_BASE_URL
}) {
  if (!authToken) {
    throw new Error('Missing SWIFTYPE_AUTH_TOKEN.');
  }

  const url = `${baseUrl.replace(/\/$/, '')}/engines/${encodeURIComponent(engine)}/analytics/${endpoint}.json`;
  const body = JSON.stringify({
    auth_token: authToken,
    start_date: startDate,
    end_date: endDate,
    per_page: String(perPage)
  });

  return requestJsonWithGetBody(url, body, endpoint);
}

function requestJsonWithGetBody(url, body, endpoint) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === 'http:' ? http : https;
    const request = transport.request(
      parsedUrl,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Swiftype ${endpoint} request failed with ${response.statusCode}: ${text}`));
            return;
          }

          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(new Error(`Swiftype ${endpoint} returned invalid JSON: ${error.message}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

export function mergeSearchAnalytics(topQueries, noResultQueries) {
  const noResultMap = new Map(noResultQueries.map((row) => [row.query.toLowerCase(), row]));
  const topMap = new Map(topQueries.map((row) => [row.query.toLowerCase(), row]));

  const allKeys = new Set([...topMap.keys(), ...noResultMap.keys()]);
  return [...allKeys]
    .map((key) => {
      const top = topMap.get(key);
      const noResult = noResultMap.get(key);
      const query = top?.query || noResult?.query || key;
      const searches = top?.count ?? 0;
      const noResults = noResult?.count ?? 0;

      return {
        query,
        searches,
        noResults,
        zeroResultRate: searches > 0 ? noResults / searches : 1,
        status: noResults > 0 ? 'Needs review' : 'Healthy'
      };
    })
    .sort((a, b) => b.noResults - a.noResults || b.searches - a.searches || a.query.localeCompare(b.query));
}
