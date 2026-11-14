import type { ScanItem, ScanResult } from '@/data/schema';
import { PHOTO, unsplash } from '@/data/seed/photos';

/**
 * Canned scan results for six sample items. Used when no backend is
 * configured, when the phone is offline, and when the live call fails twice.
 * The demo never depends on the network.
 */

export type SampleKey = 'sofa' | 'office_chair' | 'bookshelf' | 'microwave' | 'broken_chair' | 'mattress';

export type Sample = { key: SampleKey; label: string; photo: string; item: ScanItem };

const full = { x: 0.08, y: 0.14, w: 0.84, h: 0.7 };

export const SAMPLES: Sample[] = [
  {
    key: 'sofa',
    label: 'Sofa',
    photo: unsplash(PHOTO.sofaGray),
    item: {
      box: { x: 0.06, y: 0.3, w: 0.88, h: 0.5 },
      name: 'Gray three-seat sofa',
      category: 'seating',
      subcategory: 'Sofa',
      color: 'Light gray',
      material: 'Woven upholstery',
      condition: 'good',
      dimensions_in: { w: 84, d: 36, h: 33 },
      brand: null,
      description:
        'Comfortable three-seater that has been good to us. Cushions still hold their shape and the fabric is clean. Throw pillows come with it.',
      tags: ['sofa', 'couch', 'living room', 'gray', 'three-seater'],
      pickup: 'two_people',
      weight_class: 'very_heavy',
      est_value_usd: 220,
      confidence: { name: 0.96, category: 0.99, color: 0.93, material: 0.74, condition: 0.82, dimensions: 0.61, brand: 0.2, pickup: 0.9, weight: 0.78 },
      action: {
        kind: 'give',
        price_usd: null,
        reason: 'Clean, no visible damage, and sofas in this shape are claimed within a day around here.',
      },
      safety: { flag: null, message: null },
    },
  },
  {
    key: 'office_chair',
    label: 'Office chair',
    photo: unsplash(PHOTO.officeChairMesh),
    item: {
      box: full,
      name: 'Mesh-back office chair',
      category: 'seating',
      subcategory: 'Office chair',
      color: 'Yellow and black',
      material: 'Mesh, molded plastic',
      condition: 'like_new',
      dimensions_in: { w: 26, d: 25, h: 40 },
      brand: null,
      description:
        'Adjustable desk chair with a breathable mesh back. Height and tilt both work, wheels roll smoothly. Looks barely used.',
      tags: ['office chair', 'desk chair', 'ergonomic', 'mesh'],
      pickup: 'one_person',
      weight_class: 'medium',
      est_value_usd: 90,
      confidence: { name: 0.94, category: 0.99, color: 0.9, material: 0.86, condition: 0.79, dimensions: 0.72, brand: 0.15, pickup: 0.95, weight: 0.85 },
      action: {
        kind: 'sell',
        price_usd: 25,
        reason: 'Close to new, and similar chairs resell for $60 to $100. A small price tends to bring a buyer who shows up.',
      },
      safety: { flag: null, message: null },
    },
  },
  {
    key: 'bookshelf',
    label: 'Bookshelf',
    photo: unsplash(PHOTO.bookshelfWood),
    item: {
      box: full,
      name: 'Tall wooden bookshelf',
      category: 'storage',
      subcategory: 'Bookshelf',
      color: 'Medium brown',
      material: 'Wood',
      condition: 'good',
      dimensions_in: { w: 32, d: 12, h: 72 },
      brand: null,
      description:
        'Sturdy five-shelf bookcase. Shelves are straight with no sag, a few light scuffs along the sides. Books not included.',
      tags: ['bookshelf', 'bookcase', 'storage', 'wood'],
      pickup: 'two_people',
      weight_class: 'heavy',
      est_value_usd: 70,
      confidence: { name: 0.95, category: 0.98, color: 0.88, material: 0.66, condition: 0.8, dimensions: 0.58, brand: 0.1, pickup: 0.84, weight: 0.7 },
      action: {
        kind: 'give',
        price_usd: null,
        reason: 'Solid and useful. Bookshelves are one of the most requested items on the wanted board.',
      },
      safety: { flag: null, message: null },
    },
  },
  {
    key: 'microwave',
    label: 'Microwave',
    photo: unsplash(PHOTO.microwave),
    item: {
      box: full,
      name: 'Countertop microwave',
      category: 'appliances',
      subcategory: 'Microwave',
      color: 'White',
      material: 'Painted steel',
      condition: 'good',
      dimensions_in: { w: 19, d: 14, h: 11 },
      brand: null,
      description:
        'Compact microwave that heats evenly. Clean inside, turntable included. Please confirm the wattage on the back label.',
      tags: ['microwave', 'kitchen', 'appliance', 'dorm'],
      pickup: 'one_person',
      weight_class: 'medium',
      est_value_usd: 35,
      confidence: { name: 0.97, category: 0.99, color: 0.95, material: 0.8, condition: 0.64, dimensions: 0.75, brand: 0.3, pickup: 0.96, weight: 0.88 },
      action: {
        kind: 'give',
        price_usd: null,
        reason: 'Small appliances that work go quickly, especially near campus. I could not see it running, so please confirm it heats.',
      },
      safety: { flag: null, message: null },
    },
  },
  {
    key: 'broken_chair',
    label: 'Broken chair',
    photo: unsplash(PHOTO.brokenChair),
    item: {
      box: full,
      name: 'Wooden chair with a broken leg',
      category: 'seating',
      subcategory: 'Dining chair',
      color: 'Weathered brown',
      material: 'Solid wood',
      condition: 'damaged',
      dimensions_in: { w: 18, d: 19, h: 34 },
      brand: null,
      description:
        'Old wooden chair. One leg is broken and the seat has weather damage. Not safe to sit on as it is.',
      tags: ['chair', 'wood', 'for parts', 'needs repair'],
      pickup: 'one_person',
      weight_class: 'light',
      est_value_usd: 0,
      confidence: { name: 0.9, category: 0.97, color: 0.82, material: 0.85, condition: 0.93, dimensions: 0.7, brand: 0.05, pickup: 0.95, weight: 0.86 },
      action: {
        kind: 'dispose',
        price_usd: null,
        reason: 'A broken leg makes it unsafe to sit on, so it should not go to a neighbor. A reuse yard can still repair it or salvage the wood.',
      },
      safety: { flag: null, message: null },
    },
  },
  {
    key: 'mattress',
    label: 'Mattress',
    photo: unsplash(PHOTO.mattress),
    item: {
      box: full,
      name: 'Quilted mattress',
      category: 'beds',
      subcategory: 'Mattress',
      color: 'White',
      material: 'Quilted fabric over foam or springs',
      condition: 'good',
      dimensions_in: { w: 60, d: 80, h: 10 },
      brand: null,
      description: 'Queen-size quilted mattress with no visible stains.',
      tags: ['mattress', 'queen', 'bedroom'],
      pickup: 'two_people',
      weight_class: 'heavy',
      est_value_usd: 0,
      confidence: { name: 0.95, category: 0.98, color: 0.94, material: 0.6, condition: 0.55, dimensions: 0.52, brand: 0.1, pickup: 0.88, weight: 0.74 },
      action: {
        kind: 'dispose',
        price_usd: null,
        reason: 'Used mattresses are hard to pass on safely, and California recycles them for free.',
      },
      safety: {
        flag: 'mattress',
        message:
          'Most charities cannot accept used mattresses for hygiene reasons, and we keep them off the marketplace for the same reason. The good news: recycling one is free here.',
      },
    },
  },
];

export const sampleByKey = (key: SampleKey): Sample => SAMPLES.find((s) => s.key === key) ?? SAMPLES[0]!;

export function mockResult(key: SampleKey): ScanResult {
  return { items: [sampleByKey(key).item], prompt_version: 'mock', model: 'mock' };
}

/** With a real photo and no backend, cycle through the samples in demo-script order. */
const cycle: SampleKey[] = ['sofa', 'broken_chair', 'office_chair', 'bookshelf', 'microwave', 'mattress'];
let cursor = 0;
export function nextMockKey(): SampleKey {
  const key = cycle[cursor % cycle.length]!;
  cursor += 1;
  return key;
}
