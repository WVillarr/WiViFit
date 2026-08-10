// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite's web (alpha) support loads a wa-sqlite .wasm module; Metro
// doesn't treat .wasm as an asset by default.
config.resolver.assetExts.push('wasm');

// expo-sqlite on web stores the database in OPFS, which needs a
// cross-origin-isolated page (SharedArrayBuffer). The dev server doesn't set
// these headers and exposes no option for them, so without this the catalog
// fails to open with "Error code 14: unable to open database file".
// `credentialless` rather than `require-corp` so cross-origin exercise GIFs
// still load. Production web hosting needs the equivalent headers.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  return middleware(req, res, next);
};

module.exports = config;
