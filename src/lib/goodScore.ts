import type {
  Category,
  Condition,
  LatLng,
  Place,
  PlaceTier,
  SafetyFlag,
  WeightClass,
} from '@/data/types';

import { conditionRank, milesBetween } from './format';

/**
 * Good Score: how much good an option does with this specific item.
 *
 * The tier sets the base and always decides the order between tiers.
 * The adjustments only reorder options inside a tier.
 *
 *   tier 1  goes straight into someone's home         100
 *   tier 2  free pickup that keeps it in use           80
 *   tier 3  reuse, repair, specialist recycling        60
 *   tier 4  city bulky pickup and drop-off sites       40
 *   tier 5  paid junk removal                          20
 *
 *   + up to 4   they come to you, and the item is heavy
 *   + 2         open right now
 *   - up to 6   distance, one point per mile
 *   + 1         gives a tax receipt
 *
 * The largest swing is 7 up or 6 down, which is less than the 20 points
 * between tiers. A paid hauler can never outrank a charity.
 */

export const TIER_BASE: Record<PlaceTier, number> = { 1: 100, 2: 80, 3: 60, 4: 40, 5: 20 };

export const TIER_LABEL: Record<PlaceTier, string> = {
  1: 'Goes straight into a home',
  2: 'Free pickup, stays in use',
  3: 'Reuse and recycling',
  4: 'City service',
  5: 'Paid removal',
};

export type ItemForRanking = {
  category: Category;
  condition: Condition;
  weightClass: WeightClass;
  safetyFlag: SafetyFlag | null;
};

export type RankedPlace = {
  place: Place;
  score: number;
  miles: number;
  openNow: boolean;
  closesAt: number | null;
  parts: { label: string; points: number }[];
};

export type Rejected = { place: Place; reason: string; miles: number };

export function openState(place: Place, at: Date): { open: boolean; closesAt: number | null } {
  const today = place.hours?.[at.getDay()];
  if (!today) return { open: false, closesAt: null };
  const t = at.getHours() + at.getMinutes() / 60;
  const open = t >= today[0] && t < today[1];
  return { open, closesAt: open ? today[1] : null };
}

function accepts(place: Place, item: ItemForRanking): string | null {
  if (item.safetyFlag) {
    if (place.takesFlags.includes(item.safetyFlag)) return null;
    return `Can't take ${FLAG_NOUN[item.safetyFlag]}`;
  }
  if (!place.accepts.includes(item.category)) return "Doesn't take this kind of item";
  if (conditionRank[item.condition] < conditionRank[place.minCondition]) {
    return item.condition === 'damaged'
      ? 'Only takes items in working shape'
      : 'Only takes items in good condition';
  }
  return null;
}

export const FLAG_NOUN: Record<SafetyFlag, string> = {
  mattress: 'mattresses',
  car_seat: 'car seats',
  crib: 'cribs',
  hazmat: 'hazardous materials',
  refrigerant: 'appliances with refrigerant',
  prohibited: 'this item',
};

export function rankPlaces(
  places: Place[],
  item: ItemForRanking,
  from: LatLng,
  at: Date = new Date(),
): { ranked: RankedPlace[]; rejected: Rejected[] } {
  const ranked: RankedPlace[] = [];
  const rejected: Rejected[] = [];
  const heavy = item.weightClass === 'heavy' || item.weightClass === 'very_heavy';

  for (const place of places) {
    const dist = milesBetween(from, place.location);
    const reason = accepts(place, item);
    if (reason) {
      rejected.push({ place, reason, miles: dist });
      continue;
    }
    const { open, closesAt } = openState(place, at);
    const parts: RankedPlace['parts'] = [
      { label: TIER_LABEL[place.tier], points: TIER_BASE[place.tier] },
    ];
    if (place.pickup === 'free') {
      parts.push({ label: heavy ? 'Comes to you, and this is heavy' : 'Comes to you', points: heavy ? 4 : 2 });
    }
    if (open) parts.push({ label: 'Open now', points: 2 });
    if (place.taxReceipt) parts.push({ label: 'Tax receipt', points: 1 });
    // Distance matters less when they pick up from your door.
    const distPenalty = place.pickup === 'free' ? 0 : -Math.min(6, Math.round(dist));
    if (distPenalty !== 0) parts.push({ label: 'Distance', points: distPenalty });

    const score = parts.reduce((sum, p) => sum + p.points, 0);
    ranked.push({ place, score, miles: dist, openNow: open, closesAt, parts });
  }

  ranked.sort((a, b) => b.score - a.score || a.miles - b.miles);
  rejected.sort((a, b) => a.place.tier - b.place.tier || a.miles - b.miles);
  return { ranked, rejected };
}

export function hourLabel(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  const suffix = whole >= 12 ? 'pm' : 'am';
  const twelve = whole % 12 === 0 ? 12 : whole % 12;
  return mins === 0 ? `${twelve}${suffix}` : `${twelve}:${String(mins).padStart(2, '0')}${suffix}`;
}
