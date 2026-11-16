// scan-item: photo in, validated listing data out.
//
// The Anthropic API key lives only here, as a Supabase secret. The app never
// sees it. The model call, schema and retry live in ../_shared/scan-core.ts,
// shared with the local dev server in scripts/scan-server.ts.

import { createClient } from 'npm:@supabase/supabase-js@2';

import { chooseProvider, DEFAULT_MODELS, PROMPT_VERSION, runScan, ScanError } from '../_shared/scan-core.ts';

const keys = { anthropic: Deno.env.get('ANTHROPIC_API_KEY') || undefined, gemini: Deno.env.get('GEMINI_API_KEY') || undefined };
const PROVIDER = chooseProvider(keys, Deno.env.get('SCAN_PROVIDER')) ?? 'anthropic';
const API_KEY = keys[PROVIDER];
const MODEL =
  (PROVIDER === 'gemini' ? Deno.env.get('GEMINI_MODEL') : Deno.env.get('ANTHROPIC_MODEL')) || DEFAULT_MODELS[PROVIDER];

const prompt = await Deno.readTextFile(new URL(`./prompts/${PROMPT_VERSION}.md`, import.meta.url));

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function logScan(req: Request, latencyMs: number, attempts: number, ok: boolean) {
  // Best effort. Never fails the request.
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return;
    const admin = createClient(url, key);
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    const user = jwt ? (await admin.auth.getUser(jwt)).data.user : null;
    await admin.from('scan_logs').insert({
      user_id: user?.id ?? null,
      model: MODEL,
      prompt_version: PROMPT_VERSION,
      latency_ms: latencyMs,
      attempts,
      ok,
    });
  } catch {
    // ignore
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const started = Date.now();
  const body = await req.json().catch(() => null);
  try {
    const out = await runScan({
      provider: PROVIDER,
      apiKey: API_KEY,
      model: MODEL,
      prompt,
      imageBase64: body?.image_base64,
      mediaType: body?.media_type,
      hint: body?.hint,
    });
    await logScan(req, out.latency_ms, out.attempts, true);
    return json(out);
  } catch (e) {
    const err = e instanceof ScanError ? e : new ScanError(String(e), 500);
    await logScan(req, Date.now() - started, err.attempts, false);
    return json({ error: err.message, attempts: err.attempts }, err.status);
  }
});
