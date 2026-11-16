import { useEffect, useState } from 'react';

import { scanResultSchema, type ScanResult } from '@/data/schema';
import { supabase } from '@/data/supabase';
import { config, liveAi } from '@/lib/config';

import { mockResult, type SampleKey } from './mocks';

export type ScanOutcome = {
  result: ScanResult;
  source: 'live' | 'mock';
  latencyMs: number;
  /** Set when the live call was tried and we fell back. Shown in the debug overlay. */
  fallbackReason: string | null;
  /** What the model literally saw, before it filled in the listing. Live scans only. */
  observation?: string | null;
  /** The resized photo that was sent, kept in memory so the edit screen can re-scan with a correction. */
  upload?: string | null;
};

/** The result of scanning a real camera photo. */
export type CameraScan =
  | { kind: 'ok'; outcome: ScanOutcome }
  /** The model looked and found nothing worth listing. */
  | { kind: 'no_item'; hint: string; latencyMs: number }
  /** No AI could be reached. The photo was not read, so nothing is made up. */
  | { kind: 'no_ai'; reason: string; latencyMs: number };

export type AiStatus = 'checking' | 'live' | 'offline';

/** Covers one overloaded model timing out on the server plus the fallback model answering. */
const LIVE_TIMEOUT_MS = 30_000;
/** Generous enough for a tunnel round trip. */
const HEALTH_TIMEOUT_MS = 3000;
const RECHECK_MS = 10_000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

type LiveResponse =
  | (ScanResult & { observation?: string })
  | { no_item: true; hint: string; observation?: string };

function parseLive(data: unknown): LiveResponse {
  if (data && typeof data === 'object' && 'no_item' in data) {
    const d = data as { hint?: unknown; observation?: unknown };
    return {
      no_item: true,
      hint: typeof d.hint === 'string' ? d.hint : 'I could not pick out an item. Try again with the whole thing in frame.',
      observation: typeof d.observation === 'string' ? d.observation : undefined,
    };
  }
  // Validate again on the device. Never trust a payload just because our own server sent it.
  const result = scanResultSchema.parse(data);
  const observation = (data as { observation?: unknown }).observation;
  return { ...result, observation: typeof observation === 'string' ? observation : undefined };
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// ---- Local scan server (npm run scan-server) ----------------------------

let serverState: { up: boolean; at: number } | null = null;
let serverProbe: Promise<boolean> | null = null;
const listeners = new Set<(s: AiStatus) => void>();

function currentStatus(): AiStatus {
  if (liveAi) return 'live';
  if (!config.scanServerUrl) return 'offline';
  if (!serverState) return 'checking';
  return serverState.up ? 'live' : 'offline';
}

function notify() {
  const s = currentStatus();
  listeners.forEach((l) => l(s));
}

/** Is the local scan server reachable? Cached, and rechecked every few seconds while it is down. */
export function probeScanServer(force = false): Promise<boolean> {
  const url = config.scanServerUrl;
  if (!url) return Promise.resolve(false);
  if (!force && serverState && (serverState.up || Date.now() - serverState.at < RECHECK_MS)) {
    return Promise.resolve(serverState.up);
  }
  serverProbe ??= withTimeout(HEALTH_TIMEOUT_MS, (signal) => fetch(`${url}/health`, { signal }))
    .then((r) => r.ok)
    .catch(() => false)
    .then((up) => {
      serverState = { up, at: Date.now() };
      serverProbe = null;
      notify();
      return up;
    });
  return serverProbe;
}

async function callScanServer(base64: string, hint: string | null): Promise<LiveResponse> {
  const res = await withTimeout(LIVE_TIMEOUT_MS, (signal) =>
    fetch(`${config.scanServerUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: base64, media_type: 'image/jpeg', hint }),
      signal,
    }),
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? `Scan server ${res.status}`);
  return parseLive(data);
}

async function callEdgeFunction(base64: string, hint: string | null): Promise<LiveResponse> {
  if (!supabase) throw new Error('Supabase is not configured');
  const client = supabase;
  return withTimeout(LIVE_TIMEOUT_MS, async (signal) => {
    const { data, error } = await client.functions.invoke('scan-item', {
      body: { image_base64: base64, media_type: 'image/jpeg', hint },
      signal,
    });
    if (error) throw error;
    return parseLive(data);
  });
}

/** Live status for the scanner's AI pill. */
export function useAiStatus(): AiStatus {
  const [status, setStatus] = useState<AiStatus>(currentStatus);
  useEffect(() => {
    listeners.add(setStatus);
    if (!liveAi) void probeScanServer();
    return () => {
      listeners.delete(setStatus);
    };
  }, []);
  return status;
}

/**
 * Scan a real camera photo. Tries the local scan server, then the Supabase
 * edge function. If neither answers, it says so instead of returning a canned
 * result, because a canned "sofa" for a photo of a fan is worse than nothing.
 */
export async function scanCamera(base64: string | null, hint: string | null = null): Promise<CameraScan> {
  const started = Date.now();
  const errors: string[] = [];
  if (!base64) return { kind: 'no_ai', reason: 'The photo could not be prepared for upload.', latencyMs: 0 };

  const attempts: { name: string; run: () => Promise<LiveResponse> }[] = [];
  if (await probeScanServer()) attempts.push({ name: 'scan server', run: () => callScanServer(base64, hint) });
  if (liveAi) attempts.push({ name: 'edge function', run: () => callEdgeFunction(base64, hint) });

  for (const attempt of attempts) {
    try {
      const live = await attempt.run();
      const latencyMs = Date.now() - started;
      if ('no_item' in live) return { kind: 'no_item', hint: live.hint, latencyMs };
      const { observation, ...result } = live;
      return {
        kind: 'ok',
        outcome: {
          result,
          source: 'live',
          latencyMs,
          fallbackReason: errors.length ? errors.join('; ') : null,
          observation: observation ?? null,
          upload: base64,
        },
      };
    } catch (e) {
      errors.push(`${attempt.name}: ${e instanceof Error ? e.message : 'failed'}`);
      if (attempt.name === 'scan server') serverState = { up: false, at: Date.now() };
    }
  }
  notify();

  const reason = errors.length
    ? errors.join('; ')
    : config.scanServerUrl
      ? `No AI connected. Add GEMINI_API_KEY to .env and restart npx expo start (looked at ${config.scanServerUrl}).`
      : 'No AI connected on this build.';
  return { kind: 'no_ai', reason, latencyMs: Date.now() - started };
}

/** Scan one of the bundled sample items. Always the canned result for that sample. */
export async function scanSample(key: SampleKey, fallbackReason: string | null = null): Promise<ScanOutcome> {
  const started = Date.now();
  // The pause keeps the scan animation readable. A result that appears instantly feels fake.
  await wait(1100 + Math.random() * 400);
  return { result: mockResult(key), source: 'mock', latencyMs: Date.now() - started, fallbackReason };
}
