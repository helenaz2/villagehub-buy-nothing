import type { Condition } from '@/types/listing';

export type ExamResult = {
  condition: Condition;
  note: string;
};

const WEAR: { pattern: RegExp; label: string }[] = [
  { pattern: /scratch|scuff/, label: 'a small scuff' },
  { pattern: /stain/, label: 'a light stain' },
  { pattern: /chip/, label: 'a small chip' },
  { pattern: /fade|faded|bleach/, label: 'some fading' },
  { pattern: /tear|rip|hole/, label: 'a small tear' },
  { pattern: /worn|wear|pill/, label: 'everyday wear' },
  { pattern: /crack/, label: 'a hairline crack' },
];

export function examineListing(input: {
  title: string;
  description: string;
  photoCount: number;
  category: string;
}): ExamResult {
  if (input.photoCount === 0) {
    return {
      condition: 'Good condition',
      note: 'Add a photo first. This check uses the pictures you attach and any wear you describe.',
    };
  }

  const text = `${input.title} ${input.description}`.toLowerCase();
  const hits = WEAR.filter((entry) => entry.pattern.test(text)).map((entry) => entry.label);
  const photos = input.photoCount === 1 ? '1 photo' : `${input.photoCount} photos`;
  const thing = input.title.trim() || input.category.toLowerCase() || 'piece';

  if (hits.length === 0) {
    return {
      condition: 'Like new',
      note: `Nothing in the description mentions wear. With ${photos} attached, this is marked like new.`,
    };
  }

  const condition: Condition = hits.length >= 3 ? 'Well loved' : hits.some((hit) => /tear|crack/.test(hit)) ? 'Fair' : 'Good condition';
  return {
    condition,
    note: `Gently used. Noted ${hits.join(', ')}. Still a good ${thing.toLowerCase()} for a new corner. Checked ${photos} on this device.`,
  };
}
