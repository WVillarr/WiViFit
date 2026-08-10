# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Expo version note

This project targets **Expo SDK 57**, which has changed significantly from older SDKs (e.g. `expo-router/unstable-native-tabs` for tab navigation, new icon formats). Consult the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing code — don't rely on general Expo knowledge, which may be stale.

## Commands

```bash
npm install          # install dependencies
npm start             # expo start — dev server with QR code / Metro
npm run ios           # expo start --ios
npm run android        # expo start --android
npm run web            # expo start --web
npm run lint           # expo lint (ESLint)
npm run reset-project   # moves starter code to app-example/, creates a blank src/app
```

There is no test suite configured yet. To add one, follow Expo's Jest guide (https://docs.expo.dev/develop/unit-testing/).

## Architecture

- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction) with file-based routes under [src/app](src/app). `main` in [package.json](package.json) is `expo-router/entry`, so the router owns the app entry point — there is no manual `App.tsx`.
- **Path aliases**: `@/*` → `src/*` and `@/assets/*` → `assets/*` (defined in [tsconfig.json](tsconfig.json)). Always import via `@/...`, not relative paths crossing directories.
- **Tab navigation**: [src/components/app-tabs.tsx](src/components/app-tabs.tsx) uses `NativeTabs` from `expo-router/unstable-native-tabs` (SDK 57 API, not the older `Tabs` component). Tab screens are matched by file name in `src/app` (`index.tsx` → Home, `explore.tsx` → Explore).
- **Root layout**: [src/app/_layout.tsx](src/app/_layout.tsx) wraps the app in `ThemeProvider` (from `expo-router`, using `DarkTheme`/`DefaultTheme`), shows an animated splash overlay, and renders `AppTabs`.
- **Platform-specific files**: Several components have `.web.tsx` variants alongside the default (native) implementation — e.g. [animated-icon.tsx](src/components/animated-icon.tsx) / [animated-icon.web.tsx](src/components/animated-icon.web.tsx), [app-tabs.tsx](src/components/app-tabs.tsx) / [app-tabs.web.tsx](src/components/app-tabs.web.tsx), [use-color-scheme.ts](src/hooks/use-color-scheme.ts) / [use-color-scheme.web.ts](src/hooks/use-color-scheme.web.ts). Metro resolves these automatically per platform — when editing behavior that differs on web, check for and update both files.
- **Theming**: Centralized in [src/constants/theme.ts](src/constants/theme.ts) — `Colors` (light/dark palettes), `Fonts` (per-platform via `Platform.select`), and `Spacing` scale (named steps: `half`, `one`, `two`, ... `six`, not raw pixel values). `src/hooks/use-theme.ts` resolves the active theme's color object; prefer it over reaching into `Colors` directly in components. `ThemedText` and `ThemedView` ([src/components](src/components)) are the base styled primitives — use them instead of raw `Text`/`View` for anything that should respect the theme.
- **Web-only global styles**: [src/global.css](src/global.css) is imported from `theme.ts` and defines CSS custom properties (e.g. `--font-display`) consumed by `Fonts.web`.
- **Icons/images**: App icons live in [assets/expo.icon](assets/expo.icon) (adaptive icon format) and [assets/images](assets/images); tab bar icons are in `assets/images/tabIcons`.
