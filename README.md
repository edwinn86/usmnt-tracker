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

The client requests FotMob data through the configured Cloudflare Worker proxy in `src/hooks/usePlayersData.js`. Player lists are deliberately curated in `src/data/usmntPlayerIds.js`.

`scripts/generate-player-ids.mjs` is a developer utility for finding FotMob IDs from the USMNT squad page; review its output before replacing any curated lists.
