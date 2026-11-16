// The scan logic, shared by the Supabase edge function (Deno) and the local
// dev scan server (Node, scripts/scan-server.ts). It only uses `fetch` and zod,
// so it runs unchanged in both.
//
// Two providers sit behind one contract: Claude (a forced tool call) and
// Gemini (JSON mode with a response schema). Both get the same prompt and the
// same JSON schema, generated from the shared zod schema, and both outputs are
// validated with zod and retried once with the errors.
//
// The output starts with a plain `observation` field, so the model says what
// the object literally is before it fills in any listing details. That
// ordering is what stops a desk fan from becoming a "gray sofa".

import { z } from 'zod';

import { scanItemSchema, scanResultSchema, type ScanResult } from './schema.ts';

export const PROMPT_VERSION = 'v2';
export const DEFAULT_MODELS = { anthropic: 'claude-sonnet-5-5', gemini: 'gemini-3.5-flash' } as const;
/** Kept for callers that only know about Claude. */
export const DEFAULT_MODEL = DEFAULT_MODELS.anthropic;
export const MAX_IMAGE_BYTES = 3_500_000;

export type Provider = keyof typeof DEFAULT_MODELS;

export const toolInput = z.object({
  observation: z
    .string()
    .min(3)
    .max(300)
    .describe('One or two literal sentences: the main object in the frame, what it is made of, and anything else visible.'),
  items: z.array(scanItemSchema).max(6),
  retake_hint: z
    .string()
    .max(160)
    .nullable()
    .describe('Only when items is empty: a short, friendly tip for a better photo. Otherwise null.'),
});

const { $schema: _drop, ...inputSchema } = z.toJSONSchema(toolInput, { target: 'draft-7' }) as Record<string, unknown>;
export const scanJsonSchema = inputSchema;

export type ScanResponse =
  | (ScanResult & { observation: string; latency_ms: number; attempts: number; provider: Provider })
  | { no_item: true; hint: string; observation: string; latency_ms: number; attempts: number; provider: Provider };

export class ScanError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly attempts = 0,
  ) {
    super(message);
  }
}

/** One conversation with a model: ask for the scan, and if the answer is malformed, ask again with the errors. */
type Session = {
  ask: () => Promise<unknown>;
  correct: (errors: string) => void;
  /** The model that actually answered, after any fallback. */
  model: () => string;
};

const USER_TEXT = 'Look closely at this photo. Say what the object actually is in `observation` first, then list the items.';

/** The owner's correction, cleaned so it can only ever name a thing. */
function cleanHint(hint: unknown): string | null {
  if (typeof hint !== 'string') return null;
  const clean = hint.replace(/[\r\n"`<>{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  return clean.length >= 2 ? clean : null;
}

function userText(hint: string | null): string {
  if (!hint) return USER_TEXT;
  return (
    `${USER_TEXT}\n\nThe owner looked at this scan and says the item is: "${hint}". ` +
    'Treat that as the identity of the main item. Name it accordingly and fill in every other field ' +
    '(size, condition, weight, pickup, safety, action) for that kind of item, using the photo for color, material and wear. ' +
    'Return only that item.'
  );
}

type SessionOpts = { apiKey: string; model: string; prompt: string; image: string; mediaType: string; hint: string | null };

function anthropicSession(opts: SessionOpts): Session {
  type Message = { role: 'user' | 'assistant'; content: unknown };
  const messages: Message[] = [
    {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: opts.mediaType, data: opts.image } },
        { type: 'text', text: userText(opts.hint) },
      ],
    },
  ];
  let last: { toolUseId: string; content: unknown } | null = null;

  return {
    async ask() {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: 3000,
          system: opts.prompt,
          tools: [
            {
              name: 'report_items',
              description: 'Report what is in the photo, and every item in it that could be passed on, with listing details.',
              input_schema: inputSchema,
            },
          ],
          tool_choice: { type: 'tool', name: 'report_items' },
          messages,
        }),
      });
      if (!res.ok) throw new ScanError(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`, 502);
      const data = await res.json();
      const block = (data.content as { type: string; id?: string; input?: unknown }[]).find((b) => b.type === 'tool_use');
      if (!block) throw new ScanError('The model did not call the tool', 502);
      last = { toolUseId: block.id!, content: data.content };
      return block.input;
    },
    model: () => opts.model,
    correct(errors) {
      if (!last) return;
      messages.push(
        { role: 'assistant', content: last.content },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: last.toolUseId,
              is_error: true,
              content: `That did not match the schema:\n${errors}\nCall report_items again with corrected values.`,
            },
          ],
        },
      );
    },
  };
}

/** Tried in order after the configured model when Google says a model is busy or gone. */
export const GEMINI_FALLBACKS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];
/** A healthy Flash answer takes 2 to 6 s. Past this, start the next model alongside it. */
const GEMINI_HEDGE_MS = 6_000;
/** Hard cap for one ask, kept under the app's 30 s timeout. */
const GEMINI_OVERALL_MS = 26_000;

type GeminiData = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

class BusyError extends Error {}

/**
 * Thinking level per model. Measured on a 900px photo: 3.5 Flash answers in
 * about 2.5 s on "minimal" and takes 30 s on "low". Models not listed here get
 * the API default.
 */
const GEMINI_THINKING: Record<string, string> = {
  'gemini-3.5-flash': 'minimal',
  'gemini-3.1-flash-lite': 'low',
};

/**
 * Gemini accepts a subset of JSON Schema and rejects the request outright
 * ("invalid argument") on keywords outside it. Drop those. zod still enforces
 * every one of these limits when the answer comes back.
 */
const GEMINI_DROP = new Set(['additionalProperties', 'minLength', 'maxLength', 'minItems', 'maxItems']);
function forGemini(node: unknown, isPropertyMap = false): unknown {
  if (Array.isArray(node)) return node.map((n) => forGemini(n));
  if (!node || typeof node !== 'object') return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (isPropertyMap) out[k] = forGemini(v); // keys here are field names, not keywords
    else if (k === 'properties') out[k] = forGemini(v, true);
    else if (k === 'exclusiveMinimum') out.minimum = v;
    else if (!GEMINI_DROP.has(k)) out[k] = forGemini(v);
  }
  return out;
}
const geminiSchema = forGemini(inputSchema);

function geminiSession(opts: SessionOpts): Session {
  type Content = { role: 'user' | 'model'; parts: unknown[] };
  const contents: Content[] = [
    {
      role: 'user',
      parts: [{ inlineData: { mimeType: opts.mediaType, data: opts.image } }, { text: userText(opts.hint) }],
    },
  ];
  let lastText: string | null = null;
  // Once a model answers, stay on it for the correction turn.
  let models = [opts.model, ...GEMINI_FALLBACKS.filter((m) => m !== opts.model)];

  /** One model call, body included. Throws BusyError when the next model should be tried instead. */
  async function generate(model: string, signal: AbortSignal, withThinking = true): Promise<GeminiData> {
    const level = withThinking ? GEMINI_THINKING[model] : undefined;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': opts.apiKey, 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.prompt }] },
        contents,
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: geminiSchema,
          maxOutputTokens: 6000,
          ...(level ? { thinkingConfig: { thinkingLevel: level } } : {}),
        },
      }),
    });
    if (res.ok) return (await res.json()) as GeminiData;
    const text = await res.text();
    // A model that does not support the configured thinking level: ask again without it.
    if (level && res.status === 400 && /thinking/i.test(text)) return generate(model, signal, false);
    // Busy, rate limited or retired: worth trying another model. Anything else is a real error.
    if ([404, 429, 500, 503].includes(res.status)) throw new BusyError(`${model} ${res.status}`);
    throw new ScanError(`Gemini API ${res.status}: ${text.slice(0, 300)}`, 502);
  }

  /**
   * Hedged request: start the first model, and if it has not answered after a
   * few seconds, start the next one too. The first good answer wins and the
   * rest are cancelled. When Google is under load this turns a 20 s wait, or a
   * failure, into an answer from whichever model is quickest right now.
   */
  function race(): Promise<{ model: string; data: GeminiData }> {
    return new Promise((resolve, reject) => {
      const controllers: AbortController[] = [];
      const failures: string[] = [];
      let next = 0;
      let running = 0;
      let settled = false;
      let hedge: ReturnType<typeof setTimeout> | undefined;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(overall);
        clearTimeout(hedge);
        controllers.forEach((c) => c.abort());
        fn();
      };
      const giveUp = () =>
        finish(() =>
          reject(new ScanError(`Gemini is busy right now (${failures.join(', ') || 'no answer'}). Try again in a moment.`, 503)),
        );
      const overall = setTimeout(() => {
        failures.push('timed out');
        giveUp();
      }, GEMINI_OVERALL_MS);

      const launch = () => {
        if (settled || next >= models.length) return;
        const model = models[next++]!;
        const controller = new AbortController();
        controllers.push(controller);
        running += 1;
        clearTimeout(hedge);
        hedge = setTimeout(launch, GEMINI_HEDGE_MS);
        generate(model, controller.signal).then(
          (data) => finish(() => resolve({ model, data })),
          (e) => {
            running -= 1;
            if (settled) return;
            if (e instanceof ScanError) return finish(() => reject(e));
            failures.push(e instanceof BusyError ? e.message : `${model} failed`);
            if (next < models.length) launch(); // try the next one now rather than waiting for the hedge timer
            else if (running === 0) giveUp();
          },
        );
      };
      launch();
    });
  }

  return {
    async ask() {
      const { model, data } = await race();
      models = [model]; // the correction turn goes back to the model that answered
      const parts = (data.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[];
      const text = parts
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
      if (!text) {
        const why = data.promptFeedback?.blockReason ?? data.candidates?.[0]?.finishReason ?? 'empty response';
        throw new ScanError(`Gemini returned no answer (${why})`, 502);
      }
      lastText = text;
      try {
        return JSON.parse(text);
      } catch {
        return { __unparsed: text.slice(0, 200) };
      }
    },
    model: () => models[0]!,
    correct(errors) {
      if (lastText == null) return;
      contents.push(
        { role: 'model', parts: [{ text: lastText }] },
        { role: 'user', parts: [{ text: `That did not match the schema:\n${errors}\nAnswer again with corrected JSON only.` }] },
      );
    },
  };
}

/** Pick a provider from whichever key is present. Gemini wins if both are set, unless one is named. */
export function chooseProvider(keys: { anthropic?: string; gemini?: string }, preferred?: string): Provider | null {
  if (preferred === 'anthropic' && keys.anthropic) return 'anthropic';
  if (preferred === 'gemini' && keys.gemini) return 'gemini';
  if (keys.gemini) return 'gemini';
  if (keys.anthropic) return 'anthropic';
  return null;
}

export async function runScan(opts: {
  provider?: Provider;
  apiKey: string | undefined;
  model?: string;
  prompt: string;
  imageBase64: unknown;
  mediaType?: unknown;
  /** Optional correction from the owner ("it's a box fan"), used for a re-scan. */
  hint?: unknown;
}): Promise<ScanResponse> {
  const provider = opts.provider ?? 'anthropic';
  if (!opts.apiKey) throw new ScanError(`No API key set for ${provider}`, 500);
  const image = opts.imageBase64;
  if (typeof image !== 'string' || image.length < 100) throw new ScanError('image_base64 is required', 400);
  if (image.length * 0.75 > MAX_IMAGE_BYTES) throw new ScanError('Image is too large. Resize to 1024px first.', 413);
  const mediaType = typeof opts.mediaType === 'string' ? opts.mediaType : 'image/jpeg';
  const model = opts.model || DEFAULT_MODELS[provider];

  const started = Date.now();
  const sessionOpts: SessionOpts = { apiKey: opts.apiKey, model, prompt: opts.prompt, image, mediaType, hint: cleanHint(opts.hint) };
  const session = provider === 'gemini' ? geminiSession(sessionOpts) : anthropicSession(sessionOpts);

  let attempts = 0;
  let lastError = '';
  while (attempts < 2) {
    attempts += 1;
    try {
      const raw = await session.ask();
      const parsed = toolInput.safeParse(raw);
      if (parsed.success) {
        const { observation, items, retake_hint } = parsed.data;
        const latency_ms = Date.now() - started;
        if (items.length === 0) {
          return {
            no_item: true,
            hint: retake_hint ?? 'I could not pick out an item. Fit the whole thing in the frame and try again.',
            observation,
            latency_ms,
            attempts,
            provider,
          };
        }
        // House rule, enforced here rather than trusted to the model: a safety flag always means dispose.
        const safe = items.map((it) =>
          it.safety.flag && it.action.kind !== 'dispose'
            ? { ...it, action: { ...it.action, kind: 'dispose' as const, price_usd: null } }
            : it,
        );
        const result = scanResultSchema.parse({ items: safe, prompt_version: PROMPT_VERSION, model: session.model() });
        return { ...result, observation, latency_ms, attempts, provider };
      }
      lastError = z.prettifyError(parsed.error);
      // Show the model exactly what was wrong and ask once more.
      session.correct(lastError);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      // An API error (bad key, overloaded) will not fix itself on an instant retry with the same input.
      if (e instanceof ScanError) throw new ScanError(lastError, e.status, attempts);
    }
  }
  throw new ScanError(`Could not read the photo: ${lastError}`, 502, attempts);
}
