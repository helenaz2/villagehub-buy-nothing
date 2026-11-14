import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import jpeg from 'jpeg-js';

/**
 * Fast on-device check that runs before any upload. The photo is shrunk to a
 * 64px thumbnail, decoded in JS, and measured for brightness and sharpness.
 * It takes a few milliseconds and saves a wasted round trip on a photo the
 * model could not read anyway.
 */

export type Precheck =
  | { ok: true; brightness: number; sharpness: number }
  | { ok: false; reason: 'dark' | 'bright' | 'blurry'; hint: string; brightness: number; sharpness: number };

const TOO_DARK = 45;
const TOO_BRIGHT = 235;
const TOO_SOFT = 55;

function base64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function measure(rgba: Uint8Array, width: number, height: number) {
  const luma = new Float32Array(width * height);
  let sum = 0;
  for (let i = 0; i < width * height; i += 1) {
    const v = 0.299 * rgba[i * 4]! + 0.587 * rgba[i * 4 + 1]! + 0.114 * rgba[i * 4 + 2]!;
    luma[i] = v;
    sum += v;
  }
  const brightness = sum / (width * height);

  // Variance of the Laplacian: sharp photos have strong edges, blurry ones do not.
  let lapSum = 0;
  let lapSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap = luma[i - width]! + luma[i + width]! + luma[i - 1]! + luma[i + 1]! - 4 * luma[i]!;
      lapSum += lap;
      lapSq += lap * lap;
      n += 1;
    }
  }
  const mean = lapSum / n;
  const sharpness = lapSq / n - mean * mean;
  return { brightness, sharpness };
}

export async function precheck(uri: string): Promise<Precheck> {
  try {
    const ref = await ImageManipulator.manipulate(uri).resize({ width: 64 }).renderAsync();
    const thumb = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.9, base64: true });
    if (!thumb.base64) return { ok: true, brightness: 128, sharpness: 999 };
    const decoded = jpeg.decode(base64ToBytes(thumb.base64), { useTArray: true, formatAsRGBA: true });
    const { brightness, sharpness } = measure(decoded.data, decoded.width, decoded.height);
    if (brightness < TOO_DARK) {
      return { ok: false, reason: 'dark', hint: 'It is a bit dark. Turn on a light or move toward a window.', brightness, sharpness };
    }
    if (brightness > TOO_BRIGHT) {
      return { ok: false, reason: 'bright', hint: 'Too much glare. Try a different angle.', brightness, sharpness };
    }
    if (sharpness < TOO_SOFT) {
      return { ok: false, reason: 'blurry', hint: 'That came out blurry. Hold steady and step a little closer.', brightness, sharpness };
    }
    return { ok: true, brightness, sharpness };
  } catch {
    // Never block a scan because the check itself failed.
    return { ok: true, brightness: 128, sharpness: 999 };
  }
}

/** Resize for upload. 1024px on the long edge keeps the scan fast on mobile data. */
export async function compressForUpload(uri: string): Promise<{ uri: string; base64: string | null }> {
  const ref = await ImageManipulator.manipulate(uri).resize({ width: 1024 }).renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.6, base64: true });
  return { uri: out.uri, base64: out.base64 ?? null };
}
