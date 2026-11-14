import { z } from 'zod';

/**
 * The contract between the scan-item edge function and the app.
 *
 * This one file is used by both sides: the edge function validates the
 * model's output against it (and retries once on a mismatch), and the app
 * validates the edge function's response against it again before use.
 */

export const conditionSchema = z.enum(['like_new', 'good', 'worn', 'damaged']);
export const pickupSchema = z.enum(['one_person', 'two_people', 'needs_truck', 'needs_disassembly']);
export const weightSchema = z.enum(['light', 'medium', 'heavy', 'very_heavy']);
export const actionSchema = z.enum(['give', 'sell', 'donate', 'dispose']);
export const categorySchema = z.enum([
  'seating',
  'tables',
  'storage',
  'beds',
  'lighting',
  'appliances',
  'electronics',
  'decor',
  'bikes',
  'other',
]);
export const safetyFlagSchema = z.enum([
  'mattress',
  'car_seat',
  'crib',
  'hazmat',
  'refrigerant',
  'prohibited',
]);

const unit = z.number().min(0).max(1);

export const scanItemSchema = z.object({
  /** Where the item sits in the photo, as fractions of width and height. */
  box: z.object({ x: unit, y: unit, w: unit, h: unit }),
  name: z.string().min(2).max(60),
  category: categorySchema,
  subcategory: z.string().min(2).max(40),
  color: z.string().min(2).max(30),
  material: z.string().min(2).max(40),
  condition: conditionSchema,
  dimensions_in: z.object({
    w: z.number().positive().max(200),
    d: z.number().positive().max(200),
    h: z.number().positive().max(200),
  }),
  brand: z.string().max(40).nullable(),
  description: z.string().min(10).max(400),
  tags: z.array(z.string().min(2).max(24)).min(3).max(6),
  pickup: pickupSchema,
  weight_class: weightSchema,
  est_value_usd: z.number().min(0).max(5000),
  confidence: z.object({
    name: unit,
    category: unit,
    color: unit,
    material: unit,
    condition: unit,
    dimensions: unit,
    brand: unit,
    pickup: unit,
    weight: unit,
  }),
  action: z.object({
    kind: actionSchema,
    price_usd: z.number().min(0).max(2000).nullable(),
    reason: z.string().min(8).max(240),
  }),
  safety: z.object({
    flag: safetyFlagSchema.nullable(),
    message: z.string().max(280).nullable(),
  }),
});

export const scanResultSchema = z.object({
  items: z.array(scanItemSchema).min(1).max(6),
  prompt_version: z.string(),
  model: z.string(),
});

export type ScanItem = z.infer<typeof scanItemSchema>;
export type ScanResult = z.infer<typeof scanResultSchema>;
export type ConfidenceKey = keyof ScanItem['confidence'];

/** Below this, the edit screen asks the user to take a second look. */
export const LOW_CONFIDENCE = 0.7;
