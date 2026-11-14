import type { Category, ImpactEvent, WeightClass } from '@/data/types';

/**
 * Impact estimates. These are deliberately simple and conservative, and the
 * app shows the same assumptions to the user in the "How we estimate" sheet.
 *
 * weight      midpoint of the item's weight class
 * CO2e        weight x embodied-carbon factor for the category x displacement
 * money       what a neighbor would otherwise pay for a used one
 *
 * Displacement is the share of rehomed items that really replace a new
 * purchase. We use one half: some people would have bought used anyway,
 * and some would have gone without.
 */

export const WEIGHT_LBS: Record<WeightClass, number> = {
  light: 12,
  medium: 35,
  heavy: 75,
  very_heavy: 130,
};

/** kg CO2e per kg of product. Rough category averages, order of magnitude only. */
export const CARBON_FACTOR: Record<Category, number> = {
  seating: 2.4,
  tables: 1.2,
  storage: 1.2,
  beds: 2.6,
  lighting: 3.0,
  appliances: 5.5,
  electronics: 8.0,
  decor: 1.5,
  bikes: 4.0,
  other: 1.5,
};

export const DISPLACEMENT = 0.5;
const KG_PER_LB = 0.4536;

export function estimateImpact(input: {
  category: Category;
  weightClass: WeightClass;
  estValueUsd: number;
  priceUsd: number;
}): { lbs: number; co2Kg: number; savedUsd: number } {
  const lbs = WEIGHT_LBS[input.weightClass];
  const co2Kg = Math.round(lbs * KG_PER_LB * CARBON_FACTOR[input.category] * DISPLACEMENT);
  const savedUsd = Math.max(0, Math.round(input.estValueUsd - input.priceUsd));
  return { lbs, co2Kg, savedUsd };
}

export function totals(events: ImpactEvent[]) {
  return events.reduce(
    (acc, e) => ({
      items: acc.items + 1,
      lbs: acc.lbs + e.lbs,
      co2Kg: acc.co2Kg + e.co2Kg,
      savedUsd: acc.savedUsd + e.savedUsd,
    }),
    { items: 0, lbs: 0, co2Kg: 0, savedUsd: 0 },
  );
}

/** A gasoline car emits roughly 0.4 kg CO2 per mile. Used only to make the number relatable. */
export const milesNotDriven = (co2Kg: number) => Math.round(co2Kg / 0.4);
