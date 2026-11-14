import { scanResultSchema, type ScanResult } from '@/data/schema';
import { supabase } from '@/data/supabase';
import { liveAi } from '@/lib/config';

import { mockResult, nextMockKey, type SampleKey } from './mocks';

export type ScanOutcome = {
  result: ScanResult;
  source: 'live' | 'mock';
  latencyMs: number;
  /** Set when the live call was tried and we fell back. Shown in the debug overlay. */
  fallbackReason: string | null;
};

const LIVE_TIMEOUT_MS = 12_000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callEdgeFunction(base64: string): Promise<ScanResult> {
  if (!supabase) throw new Error('Supabase is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    const { data, error } = await supabase.functions.invoke('scan-item', {
      body: { image_base64: base64, media_type: 'image/jpeg' },
      signal: controller.signal,
    });
    if (error) throw error;
    // Validate again on the device. Never trust a payload just because our own server sent it.
    return scanResultSchema.parse(data);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scan a photo. Tries the live model when a backend is configured, and falls
 * back to a canned result on any failure so the flow never dead-ends.
 * `sample` pins the mock to a specific sample item (used by the sample tray).
 */
export async function scanPhoto(input: { base64: string | null; sample?: SampleKey }): Promise<ScanOutcome> {
  const started = Date.now();
  let fallbackReason: string | null = null;

  if (liveAi && input.base64 && !input.sample) {
    try {
      const result = await callEdgeFunction(input.base64);
      return { result, source: 'live', latencyMs: Date.now() - started, fallbackReason: null };
    } catch (e) {
      fallbackReason = e instanceof Error ? e.message : 'Live scan failed';
    }
  }

  // The pause keeps the scan animation readable. A result that appears instantly feels fake.
  await wait(1400 + Math.random() * 500);
  const result = mockResult(input.sample ?? nextMockKey());
  return { result, source: 'mock', latencyMs: Date.now() - started, fallbackReason };
}
