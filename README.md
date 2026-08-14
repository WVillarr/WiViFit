# WiviFit

A fitness app built with [Expo](https://expo.dev) — an offline-first exercise catalog (1,324 exercises, searchable and filterable, works in airplane mode) with routine building and workout tracking on top. See [docs/plan.md](docs/plan.md) for what's done and what's next.

## Prerequisites

- Node.js and npm
- Android SDK (for `npm run android`) or Xcode (for `npm run ios`)
- **A dev client build, not Expo Go** — the app uses native modules (`expo-sqlite` asset import, native tabs) that Expo Go doesn't support.

## Getting started

```bash
npm install
npm run build:media     # downloads bundled exercise thumbnails (once)
npm run build:catalog   # builds assets/catalog.db from the exercises dataset
npm start                # expo start — Metro + QR code
```

Then, in another terminal, install the dev client on a device or simulator:

```bash
npm run android   # or: npm run ios
```

## Commands

See [CLAUDE.md](CLAUDE.md#commands) for the full list, including the catalog data pipeline (`build:catalog`, `build:media`, `verify:catalog`) and test commands.

## Architecture

Read [CLAUDE.md](CLAUDE.md) — routing, theming, the two-database split (`catalog.db` vs `user.db`), and the phase plan are documented there rather than duplicated here.

## Learn more

- [Expo documentation](https://docs.expo.dev/) — this project targets **SDK 57**, which has changed significantly from older SDKs; consult the [versioned docs](https://docs.expo.dev/versions/v57.0.0/) rather than general Expo knowledge.
- [Expo Router](https://docs.expo.dev/router/introduction) — file-based routing, used throughout `src/app`.
