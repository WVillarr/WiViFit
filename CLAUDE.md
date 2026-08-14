# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Expo version note

This project targets **Expo SDK 57**, which has changed significantly from older SDKs (e.g. `expo-router/unstable-native-tabs` for tab navigation, new icon formats). Consult the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing code — don't rely on general Expo knowledge, which may be stale.

## Commands

```bash
npm install             # install dependencies
npm start                # expo start — dev server with QR code / Metro
npm run ios               # expo start --ios
npm run android            # expo start --android
npm run web                 # expo start --web
npm run lint                 # expo lint (ESLint)
npm run reset-project         # moves starter code to app-example/, creates a blank src/app
npm test                       # jest, one-shot
npm run test:watch              # jest --watchAll
npm run build:catalog             # rebuilds assets/catalog.db from the exercises dataset
npm run build:media                # downloads/regenerates bundled exercise thumbnails
npm run build:brand                 # rasterizes the brand mark to launcher/splash PNGs
npm run verify:catalog                # reproducibility check — builds to scratch, diffs vs committed
```

`npm test` runs the full suite once (CI-friendly); `npm run test:watch` is the old `--watchAll` behavior.

## Architecture

- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction) with file-based routes under [src/app](src/app). `main` in [package.json](package.json) is `expo-router/entry`, so the router owns the app entry point — there is no manual `App.tsx`.
- **Path aliases**: `@/*` → `src/*` and `@/assets/*` → `assets/*` (defined in [tsconfig.json](tsconfig.json)). Always import via `@/...`, not relative paths crossing directories.
- **Tab navigation**: [src/components/app-tabs.tsx](src/components/app-tabs.tsx) uses `NativeTabs` from `expo-router/unstable-native-tabs` (SDK 57 API, not the older `Tabs` component). Tab screens are matched by file name in `src/app` (`index.tsx` → Home, `explore.tsx` → Explore).
- **Root layout**: [src/app/_layout.tsx](src/app/_layout.tsx) wraps the app in `ThemeProvider` (from `expo-router`, using `DarkTheme`/`DefaultTheme`), shows an animated splash overlay, and renders a `Stack` whose `(tabs)` screen renders `AppTabs`.
- **Platform-specific files**: Several components have `.web.tsx` variants alongside the default (native) implementation — e.g. [animated-icon.tsx](src/components/animated-icon.tsx) / [animated-icon.web.tsx](src/components/animated-icon.web.tsx), [app-tabs.tsx](src/components/app-tabs.tsx) / [app-tabs.web.tsx](src/components/app-tabs.web.tsx), [use-color-scheme.ts](src/hooks/use-color-scheme.ts) / [use-color-scheme.web.ts](src/hooks/use-color-scheme.web.ts). Metro resolves these automatically per platform — when editing behavior that differs on web, check for and update both files.
- **Theming**: Centralized in [src/constants/theme.ts](src/constants/theme.ts) — `Colors` (light/dark palettes), `Fonts` (per-platform via `Platform.select`), and `Spacing` scale (named steps: `half`, `one`, `two`, ... `six`, not raw pixel values). `src/hooks/use-theme.ts` resolves the active theme's color object; prefer it over reaching into `Colors` directly in components. `ThemedText` and `ThemedView` ([src/components](src/components)) are the base styled primitives — use them instead of raw `Text`/`View` for anything that should respect the theme.
- **Web-only global styles**: [src/global.css](src/global.css) is imported from `theme.ts` and defines CSS custom properties (e.g. `--font-display`) consumed by `Fonts.web`.
- **Icons/images**: App icons live in [assets/expo.icon](assets/expo.icon) (adaptive icon format) and [assets/images](assets/images); tab bar icons are in `assets/images/tabIcons`.

## Two databases — do not confuse them

- **`catalog.db`** ([src/db/catalog-schema.ts](src/db/catalog-schema.ts)) — bundled, read-only, rebuilt from scratch by `npm run build:catalog` on every pipeline run. Never migrated in place. Search runs over two FTS5 tables, `exercises_fts_name` (titles) and `exercises_fts_prose` (instruction text, contentless) — see [src/db/catalog-client.ts](src/db/catalog-client.ts) for why they're split rather than one table.
- **`user.db`** ([src/db/user-schema.ts](src/db/user-schema.ts)) — on-device, read-write, created once via `CREATE TABLE IF NOT EXISTS` and never replaced by an app update. Favorites, recently-viewed, routines, workout sessions, and the sync outbox all live here. Cross-database reads use `ATTACH DATABASE`, not a Drizzle join.

**`CATALOG_DB_VERSION`** ([src/db/catalog-version.ts](src/db/catalog-version.ts)) **must be bumped on any schema or content change to `catalog.db`.** expo-sqlite only imports the bundled asset when no file of that name already exists on the device — ship a schema change under the same `catalog-vN.db` name and every device that already ran the app keeps serving the stale file, which throws `no such table` on the first query that touches the new schema. `scripts/catalog.test.ts` asserts the built file's `PRAGMA user_version` matches this constant, so forgetting the bump fails `npm test` instead of failing silently on a device.

## Data pipeline

`npm run build:catalog` ([scripts/build-catalog.ts](scripts/build-catalog.ts)) downloads the [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset), validates it, enriches each row with rule-derived fields ([scripts/enrichment.ts](scripts/enrichment.ts)), translates names to Spanish ([scripts/exercise-names-es.ts](scripts/exercise-names-es.ts)), applies hand-authored corrections from `data/overrides.json` and `data/name-overrides.json`, and writes `assets/catalog.db`. `data/dataset.lock.json` hashes the upstream dataset so a build with an empty `.cache/` can't silently pick up an unexpected upstream change — pass `--accept-dataset-change` when that's intentional. Rows the rules are unsure about land in `catalog-review.csv` / `catalog-names-review.csv` for manual review via the override files.

## Internationalization

Default locale is **Spanish** (`src/i18n/index.ts`), not English — `defaultLocale = 'es'`. Exercise search understands colloquial Spanish muscle names via `src/i18n/muscle-synonyms.ts` (e.g. "gemelos" → `calves`) since the dataset itself only has English muscle vocabulary.

## Phase plan

See [docs/plan.md](docs/plan.md) for what's done and what each phase covers — several code comments reference "Fase N" and assume that context.
