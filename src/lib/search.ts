import type { Item } from '@/types/listing';

const STOP = new Set([
  'a',
  'an',
  'the',
  'for',
  'my',
  'me',
  'i',
  'to',
  'of',
  'in',
  'on',
  'with',
  'and',
  'or',
  'please',
  'some',
  'want',
  'need',
  'looking',
  'find',
  'nearby',
  'it',
  'is',
]);

const CATEGORY_HINTS: Record<Item['category'], string[]> = {
  Furniture: ['chair', 'sofa', 'couch', 'table', 'desk', 'lamp', 'shelf', 'stool', 'furniture', 'nook', 'reading', 'seat', 'armchair'],
  Clothing: ['shirt', 'tote', 'bag', 'jacket', 'clothes', 'clothing', 'dress', 'shoes', 'cardigan', 'wear', 'sweater', 'wool'],
  Home: ['plant', 'ceramic', 'mug', 'cup', 'vase', 'home', 'kitchen', 'pot', 'jar', 'linen', 'blanket', 'green'],
};

const COLOR_WORDS = ['sage', 'green', 'natural', 'cream', 'black', 'white', 'terracotta', 'oak', 'blue', 'brown'];

export type SearchRead = {
  categories: Item['category'][];
  colors: string[];
  terms: string[];
  summary: string;
};

export function readQuery(query: string): SearchRead {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !STOP.has(token));
  const categories = (Object.keys(CATEGORY_HINTS) as Item['category'][]).filter((category) =>
    tokens.some((token) => CATEGORY_HINTS[category].includes(token)),
  );
  const colors = COLOR_WORDS.filter((color) => tokens.includes(color));
  const bits = [...categories.map((category) => category.toLowerCase()), ...colors, ...tokens.filter((token) => !colors.includes(token))].slice(0, 4);
  return {
    categories,
    colors,
    terms: tokens,
    summary: bits.length ? `Reading that as ${bits.join(' · ')}` : 'Try a room, a color, or what you need it for',
  };
}

function scoreItem(item: Item, read: SearchRead): number {
  const title = item.title.toLowerCase();
  const hay = [title, item.description, item.tags.join(' '), item.features.join(' '), item.color, item.category, item.condition, item.materials, item.fabric]
    .join(' ')
    .toLowerCase();
  let score = 0;
  for (const term of read.terms) {
    if (title.includes(term)) score += 6;
    else if (hay.includes(term)) score += 3;
  }
  if (read.categories.includes(item.category)) score += 4;
  if (read.colors.some((color) => item.color.toLowerCase().includes(color) || hay.includes(color))) score += 3;
  return score;
}

export function searchItems(
  items: Item[],
  query: string,
  category: string,
  area: string,
  condition: string,
  color: string,
): Item[] {
  let pool = items.filter((item) => item.status === 'available');
  if (category !== 'For you') pool = pool.filter((item) => item.category === category);
  if (area !== 'All') pool = pool.filter((item) => item.city === area || item.neighborhood === area);
  if (condition !== 'Any') pool = pool.filter((item) => item.condition === condition);
  if (color !== 'Any') pool = pool.filter((item) => item.color.toLowerCase() === color.toLowerCase());
  const trimmed = query.trim();
  if (!trimmed) return pool;
  const read = readQuery(trimmed);
  return pool
    .map((item) => ({ item, score: scoreItem(item, read) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}
