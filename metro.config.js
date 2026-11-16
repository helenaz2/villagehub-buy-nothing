// Default Expo config, plus one addition: the dev server also answers
// /curbside-scan/health and /curbside-scan/scan. The phone already reaches
// this server to load the app, on the LAN or through `npx expo start --tunnel`,
// so scanning works anywhere the app loads, with one command and no second
// port. The AI key is read from .env on this machine and never sent to the phone.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const PREFIX = '/curbside-scan';
let handlerPromise = null;
function loadHandler() {
  if (!handlerPromise) {
    const { tsImport } = require('tsx/esm/api');
    handlerPromise = tsImport('./scripts/scan-handler.ts', __filename).then((m) =>
      m.createScanHandler({ prefix: PREFIX }),
    );
    handlerPromise.catch(() => {
      handlerPromise = null; // try again on the next request
    });
  }
  return handlerPromise;
}

const previous = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (metroMiddleware, server) => {
  const next = previous ? previous(metroMiddleware, server) : metroMiddleware;
  return (req, res, done) => {
    if (!req.url || !req.url.startsWith(`${PREFIX}/`)) return next(req, res, done);
    loadHandler()
      .then((handle) => handle(req, res))
      .catch((e) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Scan handler failed to load: ${e && e.message}` }));
      });
  };
};

module.exports = config;
