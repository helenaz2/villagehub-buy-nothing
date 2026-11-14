import type { Conversation } from '@/types/listing';
export const RATING_IDLE_DELAY = 5 * 60 * 1000;
// Frontend approximation: five minutes without a message. The backend should
// confirm conversation completion and persist/deliver the invitation across devices.
export function ratingDueAt(conversation: Conversation): number | undefined {
  const last = conversation.messages.at(-1)?.sentAt;
  if (last === undefined || !Number.isFinite(last)) return undefined;
  return Math.max(last + RATING_IDLE_DELAY, conversation.ratingAvailableAt ?? 0);
}
