# Contentstack Swiftype Search Dashboard

A static React dashboard plus a Node automation script for tracking Contentstack Docs search behavior from Swiftype analytics.

## What It Tracks

- Top search queries for a selected date range
- Top queries with no results
- Zero-result rate by query volume
- Query overlap between high-volume searches and no-result searches
- Exportable table data for analysis

## Setup

```bash
npm install
cp .env.example .env
```

Add your Swiftype token to `.env`:

```bash
SWIFTYPE_AUTH_TOKEN=...
```

## Fetch Data

```bash
npm run fetch:swiftype -- --start 2025-10-01 --end 2025-10-31 --per-page 100
```

The script writes:

- `public/data/swiftype-search.json`
- `public/data/archive/swiftype-search-YYYY-MM-DD_YYYY-MM-DD.json`
- `public/data/index.json`

## Run The Dashboard

```bash
npm run dev
```

Build for deployment:

```bash
npm run build
```

## GitHub Actions

The workflow in `.github/workflows/update-swiftype-data.yml` can refresh the data on a schedule and commit the generated JSON back to the repo. Add this repository secret before enabling it:

- `SWIFTYPE_AUTH_TOKEN`

## Contentstack Launch

For Contentstack Launch, deploy the static Vite build output from `dist`. The dashboard is static after data generation, so the scheduled GitHub Action can keep `public/data/swiftype-search.json` fresh before each deployment.

The Swiftype auth token should stay server-side in GitHub Actions or the deployment environment. The browser UI only reads generated JSON files and does not expose the token.
