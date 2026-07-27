# USMNT Tracker

A responsive React app for browsing USMNT players, comparing current-season advanced FotMob stats, and reviewing prior-season summaries.

## Development

```bash
npm install
npm run dev
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run lint` | Run ESLint. |
| `npm run build` | Create the production build in `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run refresh-data` | Refresh current player data while reusing saved historical competition snapshots. |
| `npm run refresh-data:all` | Refresh player data and every historical competition snapshot. |
| `npm run deploy` | Build and publish the site to GitHub Pages. |

## Project structure

```text
src/
  components/
    cards/       Player-card presentation and flip behavior
    roster/      Roster tabs, filtering, sorting, and card grid
  data/          Curated FotMob player ID lists
  hooks/         FotMob data loading and normalization
  styles/        Application stylesheet
scripts/          Development utilities
fixtures/         Saved FotMob response for local inspection
public/           Application images and icons
```

## Data

Player lists are deliberately curated in `src/data/usmntPlayerIds.js`.

Local development defaults to live data through the configured Cloudflare Worker proxy. Production builds use the static files under `public/data`, so public visitors do not trigger upstream FotMob requests.

To update the deployed data:

```bash
npm run refresh-data
npm run build
npm run deploy
```

The first refresh should use `npm run refresh-data:all`. Later weekly refreshes can use `npm run refresh-data`; historical competition snapshots are reused while current-season data is replaced.

You can explicitly select a data source when needed:

```bash
# PowerShell
$env:VITE_DATA_MODE="live"; npm run dev
$env:VITE_DATA_MODE="snapshot"; npm run dev
```

Snapshot files are served like any other deployed static asset. For example, `public/data/manifest.json` becomes `/data/manifest.json` on the published site.

`scripts/generate-player-ids.mjs` is a developer utility for finding FotMob IDs from the USMNT squad page; review its output before replacing any curated lists.
