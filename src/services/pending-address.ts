import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { saveStreet } from './profiles';

const key = 'villagehub.pending-private-address';
function storage() { return Platform.OS === 'web' ? window.localStorage : AsyncStorage; }
// Optional street is a device-local draft until email confirmation. It never
// enters public profiles, auth metadata, logs, or a client-visible JWT.
export async function rememberPendingStreet(email: string, street: string) {
  await storage().setItem(key, JSON.stringify({ email: email.trim().toLowerCase(), street: street.trim(), expiresAt: Date.now() + 86400000 }));
}
export async function clearPendingStreet() { await storage().removeItem(key); }
export async function savePendingStreet(user: { id: string; email?: string }) {
  const raw = await storage().getItem(key);
  if (!raw) return;
  let draft: { email: string; street: string; expiresAt: number };
  try { draft = JSON.parse(raw); } catch { await clearPendingStreet(); return; }
  if (!draft || typeof draft.email !== 'string' || typeof draft.street !== 'string' || !Number.isFinite(draft.expiresAt) || draft.expiresAt < Date.now()) {
    await clearPendingStreet(); return;
  }
  if (draft.email !== user.email?.toLowerCase()) return;
  await saveStreet(user.id, draft.street);
  await clearPendingStreet();
}
