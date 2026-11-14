// scan-item: photo in, validated listing data out.
//
// The Anthropic API key lives only here, as a Supabase secret. The app never
// sees it. The model is asked to call a single tool whose input schema is
// generated from the shared zod schema, so the output is structured by
// construction. The result is then validated with zod anyway, and the call is
// retried once with the validation errors if it does not match.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'zod';

import { scanItemSchema, scanResultSchema } from '../_shared/schema.ts';

const PROMPT_VERSION = 'v1';
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-5-5';
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const MAX_IMAGE_BYTES = 3_500_000;

const prompt = await Deno.readTextFile(new URL(`./prompts/${PROMPT_VERSION}.md`, import.meta.url));

const toolInput = z.object({ items: z.array(scanItemSchema).min(1).max(6) });
const inputSchema = z.toJSONSchema(toolInput, { target: 'draft-7' });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Message = { role: 'user' | 'assistant'; content: unknown };

async function callModel(messages: Message[]) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      system: prompt,
      tools: [
        {
          name: 'report_items',
          description: 'Report every item in the photo that could be passed on, with listing details.',
          input_schema: inputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'report_items' },
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const block = (data.content as { type: string; id?: string; input?: unknown }[]).find((b) => b.type === 'tool_use');
  if (!block) throw new Error('The model did not call the tool');
  return { input: block.input, toolUseId: block.id!, content: data.content };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (!API_KEY) return json({ error: 'ANTHROPIC_API_KEY is not set' }, 500);

  const started = Date.now();
  const body = await req.json().catch(() => null);
  const image = body?.image_base64;
  const mediaType = body?.media_type ?? 'image/jpeg';
  if (typeof image !== 'string' || image.length < 100) return json({ error: 'image_base64 is required' }, 400);
  if (image.length * 0.75 > MAX_IMAGE_BYTES) return json({ error: 'Image is too large. Resize to 1024px first.' }, 413);

  const messages: Message[] = [
    {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: 'List the items in this photo.' },
      ],
    },
  ];

  let attempts = 0;
  let lastError = '';
  let result: z.infer<typeof scanResultSchema> | null = null;

  while (attempts < 2 && !result) {
    attempts += 1;
    try {
      const call = await callModel(messages);
      const parsed = toolInput.safeParse(call.input);
      if (parsed.success) {
        result = scanResultSchema.parse({ items: parsed.data.items, prompt_version: PROMPT_VERSION, model: MODEL });
        break;
      }
      lastError = z.prettifyError(parsed.error);
      // Show the model exactly what was wrong and ask once more.
      messages.push(
        { role: 'assistant', content: call.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: call.toolUseId,
              is_error: true,
              content: `That did not match the schema:\n${lastError}\nCall report_items again with corrected values.`,
            },
          ],
        },
      );
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  const latencyMs = Date.now() - started;

  // Best-effort latency log. Never fails the request.
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (url && key) {
      const admin = createClient(url, key);
      const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
      const user = jwt ? (await admin.auth.getUser(jwt)).data.user : null;
      await admin.from('scan_logs').insert({
        user_id: user?.id ?? null,
        model: MODEL,
        prompt_version: PROMPT_VERSION,
        latency_ms: latencyMs,
        attempts,
        ok: !!result,
      });
    }
  } catch {
    // ignore
  }

  if (!result) return json({ error: 'Could not read the photo', detail: lastError, attempts }, 502);
  return json({ ...result, latency_ms: latencyMs, attempts });
});
