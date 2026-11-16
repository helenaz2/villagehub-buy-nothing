/**
 * Standalone scan server. Optional: `npx expo start` already serves scanning
 * at /curbside-scan on the dev server (see metro.config.js). Use this only
 * when the app should scan through a separate address, set with
 * EXPO_PUBLIC_SCAN_URL=http://<this machine>:8787
 *
 *   npm run scan-server
 */
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';

import { createScanHandler, scanSetup } from './scan-handler.ts';

try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));
} catch {
  // No .env file. Fall through to the check below.
}

const PORT = Number(process.env.SCAN_SERVER_PORT ?? 8787);
const { provider, model } = scanSetup();
if (!provider) {
  console.error('No AI key found. Add GEMINI_API_KEY or ANTHROPIC_API_KEY to .env (no EXPO_PUBLIC_ prefix) and run this again.');
  process.exit(1);
}

const handle = createScanHandler();
const server = createServer((req, res) => {
  void handle(req, res).then((handled) => {
    if (!handled) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"Not found"}');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .find((n) => n && n.family === 'IPv4' && !n.internal)?.address;
  console.log(`Curbside scan server on port ${PORT}, ${provider} ${model}`);
  console.log(`  this machine: http://localhost:${PORT}/health`);
  if (lan) console.log(`  your phone:   http://${lan}:${PORT}/health  (set EXPO_PUBLIC_SCAN_URL=http://${lan}:${PORT})`);
});
