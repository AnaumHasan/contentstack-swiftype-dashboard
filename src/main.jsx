import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertCircle,
  ArrowDownAZ,
  CalendarDays,
  Download,
  RefreshCw,
  Search,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import './styles.css';

const DATA_URL = '/data/swiftype-search.json';
const INDEX_URL = '/data/index.json';

function numberFormat(value) {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function percentFormat(value) {
  return `${Math.round((value || 0) * 100)}%`;
}

function toCsv(rows) {
  const headers = ['query', 'searches', 'noResults', 'zeroResultRate', 'status'];
  const lines = rows.map((row) =>
    headers
      .map((key) => {
        const value = key === 'zeroResultRate' ? percentFormat(row[key]) : row[key];
        return `"${String(value).replaceAll('"', '""')}"`;
      })
      .join(',')
  );
  return [headers.join(','), ...lines].join('\n');
}

function downloadCsv(rows) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = 'swiftype-search-queries.csv';
  link.click();
  URL.revokeObjectURL(href);
}

function MetricCard({ icon: Icon, label, value, detail, tone = 'default' }) {
  return (
    <section className={`metric metric-${tone}`}>
      <div className="metric-icon" aria-hidden="true">
        <Icon size={20} />
      </div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </section>
  );
}

function QueryBars({ rows, mode }) {
  const max = Math.max(...rows.map((row) => (mode === 'noResults' ? row.noResults : row.searches)), 1);
  return (
    <div className="bar-list">
      {rows.slice(0, 8).map((row) => {
        const value = mode === 'noResults' ? row.noResults : row.searches;
        return (
          <div className="bar-row" key={`${mode}-${row.query}`}>
            <span title={row.query}>{row.query}</span>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.max((value / max) * 100, 4)}%` }} />
            </div>
            <b>{numberFormat(value)}</b>
          </div>
        );
      })}
    </div>
  );
}

function QueryTable({ rows }) {
  if (rows.length === 0) {
    return (
      <div className="no-rows">
        <AlertCircle size={22} />
        <strong>No queries found for this view</strong>
        <span>Try another archived range or run the fetch script for a period with Swiftype activity.</span>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Query</th>
            <th>Searches</th>
            <th>No results</th>
            <th>Zero-result rate</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.query}>
              <td>
                <span className="query-name">{row.query}</span>
              </td>
              <td>{numberFormat(row.searches)}</td>
              <td>{numberFormat(row.noResults)}</td>
              <td>
                <span className="rate-cell">
                  <span style={{ width: `${Math.min((row.zeroResultRate || 0) * 100, 100)}%` }} />
                  {percentFormat(row.zeroResultRate)}
                </span>
              </td>
              <td>
                <span className={`status ${row.noResults > 0 ? 'status-review' : 'status-healthy'}`}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [ranges, setRanges] = useState([]);
  const [selectedRangeUrl, setSelectedRangeUrl] = useState(DATA_URL);
  const [activeTab, setActiveTab] = useState('all');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('noResults');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(INDEX_URL)
      .then((response) => (response.ok ? response.json() : { ranges: [] }))
      .then((payload) => setRanges(payload.ranges || []))
      .catch(() => setRanges([]));
  }, []);

  useEffect(() => {
    fetch(selectedRangeUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${selectedRangeUrl}`);
        return response.json();
      })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [selectedRangeUrl]);

  const rows = useMemo(() => {
    const source = data?.combined || [];
    return source
      .filter((row) => {
        if (activeTab === 'noResults') return row.noResults > 0;
        if (activeTab === 'top') return row.searches > 0;
        return true;
      })
      .filter((row) => row.query.toLowerCase().includes(filter.toLowerCase()))
      .sort((a, b) => {
        if (sort === 'query') return a.query.localeCompare(b.query);
        if (sort === 'searches') return b.searches - a.searches;
        if (sort === 'rate') return b.zeroResultRate - a.zeroResultRate;
        return b.noResults - a.noResults;
      });
  }, [activeTab, data, filter, sort]);

  if (error) {
    return (
      <main className="app-shell">
        <div className="empty-state">
          <AlertCircle />
          <h1>Search analytics could not load</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="app-shell">
        <div className="empty-state">
          <RefreshCw className="spin" />
          <h1>Loading search analytics</h1>
        </div>
      </main>
    );
  }

  const summary = data.summary || {};
  const generatedDate = data.generatedAt ? format(new Date(data.generatedAt), 'MMM d, yyyy HH:mm') : 'Unknown';
  const source = data.source || {};

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="brand-mark">
            <span>CS</span>
            <b>Contentstack Docs Search</b>
          </div>
          <h1>Swiftype Search Results Dashboard</h1>
        </div>
        <button className="primary-action" onClick={() => downloadCsv(rows)}>
          <Download size={18} />
          Export CSV
        </button>
      </header>

      <section className="range-panel">
        <div className="range-chip">
          <CalendarDays size={18} />
          {source.startDate} to {source.endDate}
        </div>
        <label className="range-select">
          Range
          <select value={selectedRangeUrl} onChange={(event) => setSelectedRangeUrl(event.target.value)}>
            <option value={DATA_URL}>Latest generated range</option>
            {ranges.map((range) => (
              <option key={range.url} value={range.url}>
                {range.label}
              </option>
            ))}
          </select>
        </label>
        <div className="range-meta">Engine: {source.engine}</div>
        <div className="range-meta">Generated: {generatedDate}</div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          icon={Search}
          label="Tracked searches"
          value={numberFormat(summary.totalSearches)}
          detail={`${numberFormat(summary.totalTrackedQueries)} unique tracked queries`}
        />
        <MetricCard
          icon={AlertCircle}
          label="No-result searches"
          value={numberFormat(summary.totalNoResults)}
          detail={`${numberFormat(summary.queriesNeedingReview)} queries need review`}
          tone="warning"
        />
        <MetricCard
          icon={TrendingUp}
          label="No-result share"
          value={percentFormat((summary.totalNoResults || 0) / Math.max(summary.totalSearches || 0, 1))}
          detail="Based on current top query sample"
          tone="accent"
        />
      </section>

      <section className="insights-grid">
        <div className="panel">
          <div className="panel-heading">
            <h2>Top query demand</h2>
            <span>Volume</span>
          </div>
          <QueryBars rows={[...(data.combined || [])].sort((a, b) => b.searches - a.searches)} mode="searches" />
        </div>
        <div className="panel">
          <div className="panel-heading">
            <h2>No-result pressure</h2>
            <span>Failed searches</span>
          </div>
          <QueryBars rows={[...(data.combined || [])].sort((a, b) => b.noResults - a.noResults)} mode="noResults" />
        </div>
      </section>

      <section className="table-panel">
        <div className="controls">
          <div className="tabs" role="tablist" aria-label="Query views">
            <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}>All</button>
            <button className={activeTab === 'top' ? 'active' : ''} onClick={() => setActiveTab('top')}>Top queries</button>
            <button className={activeTab === 'noResults' ? 'active' : ''} onClick={() => setActiveTab('noResults')}>No results</button>
          </div>
          <label className="search-box">
            <Search size={18} />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter queries" />
          </label>
          <label className="select-box">
            <ArrowDownAZ size={18} />
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="noResults">No results</option>
              <option value="searches">Searches</option>
              <option value="rate">Zero-result rate</option>
              <option value="query">Query</option>
            </select>
          </label>
        </div>
        <QueryTable rows={rows} />
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
