import { randomUUID } from 'expo-crypto';

import type {
  ActionKind,
  Category,
  ClaimMode,
  Condition,
  LatLng,
  Pickup,
  WeightClass,
} from '@/data/types';

const R_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function milesBetween(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.sqrt(h));
}

export function miles(n: number): string {
  if (n < 10) return `${Math.max(0.1, n).toFixed(1)} mi`;
  return `${Math.round(n)} mi`;
}

/** Distance as a phrase that can start a line: "On your block" or "0.4 mi away". */
export function away(n: number): string {
  return n < 0.15 ? 'On your block' : `${miles(n)} away`;
}

export function ago(ts: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ts) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function clock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function dayAndTime(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const today = new Date(now);
  const tomorrow = new Date(now + 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const day = same(d, today)
    ? 'Today'
    : same(d, tomorrow)
      ? 'Tomorrow'
      : d.toLocaleDateString([], { weekday: 'long' });
  return `${day} at ${clock(ts)}`;
}

export const price = (usd: number) => (usd <= 0 ? 'Free' : `$${Math.round(usd)}`);

export const inToCm = (inches: number) => Math.round(inches * 2.54);

export function dims(d: { w: number; d: number; h: number }, unit: 'in' | 'cm' = 'in'): string {
  const f = (n: number) => (unit === 'in' ? Math.round(n) : inToCm(n));
  return `${f(d.w)} × ${f(d.d)} × ${f(d.h)} ${unit}`;
}

export const conditionLabel: Record<Condition, string> = {
  like_new: 'Like new',
  good: 'Good',
  worn: 'Worn',
  damaged: 'Damaged',
};

export const conditionRank: Record<Condition, number> = {
  like_new: 3,
  good: 2,
  worn: 1,
  damaged: 0,
};

export const pickupLabel: Record<Pickup, string> = {
  one_person: 'One person can carry it',
  two_people: 'Takes two people',
  needs_truck: 'Needs a truck',
  needs_disassembly: 'Comes apart first',
};

export const pickupShort: Record<Pickup, string> = {
  one_person: 'One person',
  two_people: 'Two people',
  needs_truck: 'Truck',
  needs_disassembly: 'Take apart',
};

export const weightLabel: Record<WeightClass, string> = {
  light: 'Under 20 lb',
  medium: '20 to 50 lb',
  heavy: '50 to 100 lb',
  very_heavy: 'Over 100 lb',
};

export const categoryLabel: Record<Category, string> = {
  seating: 'Seating',
  tables: 'Tables and desks',
  storage: 'Shelves and storage',
  beds: 'Beds',
  lighting: 'Lighting',
  appliances: 'Appliances',
  electronics: 'Electronics',
  decor: 'Decor',
  bikes: 'Bikes',
  other: 'Everything else',
};

export const actionLabel: Record<ActionKind, string> = {
  give: 'Give it away',
  sell: 'Sell it cheap',
  donate: 'Donate it',
  dispose: 'Recycle or dispose',
};

export const modeLabel: Record<ClaimMode, string> = {
  first_come: 'First to claim gets it',
  owner_picks: 'I pick from who is interested',
};

export function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

/**
 * Every id is a UUID so rows created on the device can be written straight to
 * Postgres. The prefix only documents intent at the call site.
 */
export function uid(_prefix: string): string {
  return randomUUID();
}
