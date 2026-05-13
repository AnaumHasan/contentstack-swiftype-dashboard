# Contentstack Launch Deployment

Use these settings when creating the project in Contentstack Launch.

## Project Source

- Source type: GitHub
- Repository: `AnaumHasan/contentstack-swiftype-dashboard`
- Branch: `main`

## Build And Output Settings

- Framework preset: `Other` or `CSR`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Server command: leave blank
- Node.js version: `22`

The Launch build creates a static dashboard in `dist` with `node scripts/build-static.mjs`. The Swiftype token is not needed in Launch because the UI reads generated JSON files from `public/data`. The daily GitHub Actions workflow fetches Swiftype analytics and commits updated JSON back to the repository.

## Required Secret

Add this GitHub repository secret before relying on the daily data refresh:

- `SWIFTYPE_AUTH_TOKEN`

## Redeployment

Enable automatic redeployment in Launch for the `main` branch. When the daily GitHub Actions workflow commits refreshed analytics JSON, Launch can redeploy the latest dashboard automatically.
