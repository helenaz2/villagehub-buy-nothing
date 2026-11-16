/**
 * The HTTP side of scanning, shared by two hosts:
 *
 * - metro.config.js mounts it on the Expo dev server at /curbside-scan, so a
 *   phone that can load the app can also scan, on the LAN or over --tunnel.
 * - scripts/scan-server.ts serves it on its own port, for EXPO_PUBLIC_SCAN_URL.
 *
 * Keys come from process.env (Expo loads .env into it) and never reach the phone.
 */
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';

import { chooseProvider, DEFAULT_MODELS, PROMPT_VERSION, runScan, ScanError, type Provider } from '../supabase/functions/_shared/scan-core.ts';

const MAX_BODY_BYTES = 6_000_000;

export type ScanSetup = { provider: Provider | null; model: string | null };

export function scanSetup(): ScanSetup {
  const keys = { anthropic: process.env.ANTHROPIC_API_KEY || undefined, gemini: process.env.GEMINI_API_KEY || undefined };
  const provider = chooseProvider(keys, process.env.SCAN_PROVIDER);
  if (!provider) return { provider: null, model: null };
  const model = (provider === 'gemini' ? process.env.GEMINI_MODEL : process.env.ANTHROPIC_MODEL) || DEFAULT_MODELS[provider];
  return { provider, model };
}

/**
 * Returns a handler that answers `${prefix}/health` and `${prefix}/scan` and
 * returns false for anything else, so a host can pass the request on.
 */
export function createScanHandler(opts: { prefix?: string; log?: (line: string) => void } = {}) {
  const prefix = opts.prefix ?? '';
  const log = opts.log ?? ((line: string) => console.log(line));
  const prompt = readFileSync(
    fileURLToPath(new URL(`../supabase/functions/scan-item/prompts/${PROMPT_VERSION}.md`, import.meta.url)),
    'utf8',
  );
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const path = (req.url ?? '').split('?')[0]!;
    if (!path.startsWith(`${prefix}/`)) return false;
    const route = path.slice(prefix.length);
    const send = (status: number, body: unknown) => {
      res.writeHead(status, headers);
      res.end(JSON.stringify(body));
      return true;
    };

    if (req.method === 'OPTIONS') return send(204, {});
    const { provider, model } = scanSetup();

    if (route === '/health') {
      // 503 without a key, so the app shows "samples only" instead of failing every scan.
      if (!provider) return send(503, { ok: false, error: 'No GEMINI_API_KEY or ANTHROPIC_API_KEY in .env' });
      return send(200, { ok: true, provider, model, prompt_version: PROMPT_VERSION });
    }
    if (route !== '/scan') return send(404, { error: 'Not found' });
    if (req.method !== 'POST') return send(405, { error: 'POST only' });
    if (!provider) return send(503, { error: 'No GEMINI_API_KEY or ANTHROPIC_API_KEY in .env' });

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY_BYTES) return send(413, { error: 'Photo is too large' });
      chunks.push(chunk as Buffer);
    }
    let body: { image_base64?: unknown; media_type?: unknown; hint?: unknown } | null = null;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return send(400, { error: 'Body must be JSON' });
    }

    const started = Date.now();
    try {
      const out = await runScan({
        provider,
        apiKey: provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.ANTHROPIC_API_KEY,
        model: model ?? undefined,
        prompt,
        imageBase64: body?.image_base64,
        mediaType: body?.media_type,
        hint: body?.hint,
      });
      const what = 'no_item' in out ? 'no item' : out.items.map((i) => i.name).join(', ');
      const hinted = typeof body?.hint === 'string' && body.hint ? ` (hint: ${body.hint})` : '';
      log(`[scan] ${out.latency_ms} ms via ${'model' in out ? out.model : provider}${hinted}: ${what}\n       saw: ${out.observation}`);
      return send(200, out);
    } catch (e) {
      const err = e instanceof ScanError ? e : new ScanError(String(e), 500);
      log(`[scan] failed after ${Date.now() - started} ms: ${err.message}`);
      return send(err.status, { error: err.message, attempts: err.attempts });
    }
  };
}
