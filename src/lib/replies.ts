import type { Item } from '@/types/listing';

export function suggestReplies(item: Item, hostName: string): string[] {
  const first = hostName.split(' ')[0] ?? hostName;
  const thing = item.title.toLowerCase();
  return [
    `Hi ${first}! I love the ${thing}. Is it still available? I can pick it up today.`,
    `Hi ${first}! I'm around after 5 pm. Would that work for you?`,
    `Hi ${first}! Porch pickup in ${item.neighborhood} works on my side if that's easier.`,
  ];
}

export function hostReply(text: string, item: Item): string {
  const lower = text.toLowerCase();
  if (lower.includes('5')) {
    return `After 5 works. I'll leave the ${item.title.toLowerCase()} on the porch and send a note.`;
  }
  if (lower.includes('today') || lower.includes('available')) {
    return `Yes, it's still here. Today is fine — message me when you're close.`;
  }
  if (lower.includes('porch') || lower.includes('pickup')) {
    return `Porch pickup is perfect. I'll share the exact address once we confirm a time.`;
  }
  return `Thanks for the note. It's still available, and pickup in ${item.neighborhood} is easiest.`;
}
