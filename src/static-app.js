const DATA_URL = '/data/swiftype-search.json';
const INDEX_URL = '/data/index.json';

const state = {
  data: null,
  ranges: [],
  tab: 'all',
  sort: 'noResults',
  filter: '',
  selectedRange: DATA_URL
};

const numberFormat = new Intl.NumberFormat('en-US');
const $ = (selector) => document.querySelector(selector);

function percent(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getRows() {
  return [...(state.data?.combined || [])]
    .filter((row) => {
      if (state.tab === 'noResults') return row.noResults > 0;
      if (state.tab === 'top') return row.searches > 0;
      return true;
    })
    .filter((row) => row.query.toLowerCase().includes(state.filter.toLowerCase()))
    .sort((a, b) => {
      if (state.sort === 'query') return a.query.localeCompare(b.query);
      if (state.sort === 'searches') return b.searches - a.searches;
      if (state.sort === 'rate') return b.zeroResultRate - a.zeroResultRate;
      return b.noResults - a.noResults;
    });
}

function metric(label, value, detail, tone = '') {
  return `<section class="metric ${tone}">
    <p>${label}</p>
    <strong>${value}</strong>
    <span>${detail}</span>
  </section>`;
}

function bars(rows, mode) {
  const top = [...rows].sort((a, b) => b[mode] - a[mode]).slice(0, 8);
  const max = Math.max(...top.map((row) => row[mode]), 1);
  if (!top.length) return '<div class="no-rows compact">No data for this range.</div>';
  return top.map((row) => {
    const value = row[mode] || 0;
    const width = Math.max((value / max) * 100, 4);
    return `<div class="bar-row">
      <span title="${escapeHtml(row.query)}">${escapeHtml(row.query)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
      <b>${numberFormat.format(value)}</b>
    </div>`;
  }).join('');
}

function table(rows) {
  if (!rows.length) {
    return `<div class="no-rows"><strong>No queries found for this view</strong><span>Try another archived range or run the fetch script for a period with Swiftype activity.</span></div>`;
  }

  return `<div class="table-wrap"><table>
    <thead><tr><th>Query</th><th>Searches</th><th>No results</th><th>Zero-result rate</th><th>Status</th></tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>
        <td><span class="query-name">${escapeHtml(row.query)}</span></td>
        <td>${numberFormat.format(row.searches || 0)}</td>
        <td>${numberFormat.format(row.noResults || 0)}</td>
        <td><span class="rate-cell"><span style="width:${Math.min((row.zeroResultRate || 0) * 100, 100)}%"></span>${percent(row.zeroResultRate)}</span></td>
        <td><span class="status ${row.noResults > 0 ? 'status-review' : 'status-healthy'}">${escapeHtml(row.status)}</span></td>
      </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function csv(rows) {
  const headers = ['query', 'searches', 'noResults', 'zeroResultRate', 'status'];
  return [headers.join(','), ...rows.map((row) => headers.map((key) => {
    const value = key === 'zeroResultRate' ? percent(row[key]) : row[key];
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }).join(','))].join('\n');
}

function render() {
  const data = state.data;
  if (!data) return;
  const summary = data.summary || {};
  const source = data.source || {};
  const rows = getRows();
  const allRows = data.combined || [];
  const generated = data.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'Unknown';

  $('#app').innerHTML = `
    <header class="topbar">
      <div>
        <div class="brand-mark"><span>CS</span><b>Contentstack Docs Search</b></div>
        <h1>Swiftype Search Results Dashboard</h1>
      </div>
      <button class="primary-action" id="export">Export CSV</button>
    </header>
    <section class="range-panel">
      <div class="range-chip">${escapeHtml(source.startDate)} to ${escapeHtml(source.endDate)}</div>
      <label class="range-select">Range
        <select id="range">
          <option value="${DATA_URL}" ${state.selectedRange === DATA_URL ? 'selected' : ''}>Latest generated range</option>
          ${state.ranges.map((range) => `<option value="${range.url}" ${state.selectedRange === range.url ? 'selected' : ''}>${escapeHtml(range.label)}</option>`).join('')}
        </select>
      </label>
      <div class="range-meta">Engine: ${escapeHtml(source.engine)}</div>
      <div class="range-meta">Generated: ${escapeHtml(generated)}</div>
    </section>
    <section class="metrics-grid">
      ${metric('Tracked searches', numberFormat.format(summary.totalSearches || 0), `${numberFormat.format(summary.totalTrackedQueries || 0)} unique tracked queries`)}
      ${metric('No-result searches', numberFormat.format(summary.totalNoResults || 0), `${numberFormat.format(summary.queriesNeedingReview || 0)} queries need review`, 'warning')}
      ${metric('No-result share', percent((summary.totalNoResults || 0) / Math.max(summary.totalSearches || 0, 1)), 'Based on current top query sample', 'accent')}
    </section>
    <section class="insights-grid">
      <div class="panel"><div class="panel-heading"><h2>Top query demand</h2><span>Volume</span></div>${bars(allRows, 'searches')}</div>
      <div class="panel"><div class="panel-heading"><h2>No-result pressure</h2><span>Failed searches</span></div>${bars(allRows, 'noResults')}</div>
    </section>
    <section class="table-panel">
      <div class="controls">
        <div class="tabs">
          <button data-tab="all" class="${state.tab === 'all' ? 'active' : ''}">All</button>
          <button data-tab="top" class="${state.tab === 'top' ? 'active' : ''}">Top queries</button>
          <button data-tab="noResults" class="${state.tab === 'noResults' ? 'active' : ''}">No results</button>
        </div>
        <input id="filter" value="${escapeHtml(state.filter)}" placeholder="Filter queries" />
        <select id="sort">
          <option value="noResults" ${state.sort === 'noResults' ? 'selected' : ''}>No results</option>
          <option value="searches" ${state.sort === 'searches' ? 'selected' : ''}>Searches</option>
          <option value="rate" ${state.sort === 'rate' ? 'selected' : ''}>Zero-result rate</option>
          <option value="query" ${state.sort === 'query' ? 'selected' : ''}>Query</option>
        </select>
      </div>
      ${table(rows)}
    </section>`;

  $('#export').addEventListener('click', () => {
    const blob = new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'swiftype-search-queries.csv';
    link.click();
    URL.revokeObjectURL(href);
  });
  $('#range').addEventListener('change', (event) => loadData(event.target.value));
  $('#sort').addEventListener('change', (event) => { state.sort = event.target.value; render(); });
  $('#filter').addEventListener('input', (event) => { state.filter = event.target.value; render(); });
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    state.tab = button.dataset.tab;
    render();
  }));
}

async function loadData(url = DATA_URL) {
  state.selectedRange = url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  state.data = await response.json();
  render();
}

async function init() {
  try {
    const indexResponse = await fetch(INDEX_URL);
    state.ranges = indexResponse.ok ? (await indexResponse.json()).ranges || [] : [];
    await loadData(DATA_URL);
  } catch (error) {
    $('#app').innerHTML = `<div class="empty-state"><h1>Search analytics could not load</h1><p>${escapeHtml(error.message)}</p></div>`;
  }
}

init();
