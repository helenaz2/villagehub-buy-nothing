import { syncedBackend } from '@/lib/config';

import { DEMO_NEIGHBOR } from './seed/people';
import { useStore } from './store';

/**
 * In demo mode there is only one phone, so a scripted neighbor plays the other
 * side of every exchange: they claim what you publish, confirm what you claim,
 * and answer in chat. With the synced backend this is switched off and real
 * people do the talking.
 */

const enabled = () => !syncedBackend;
const later = (ms: number, fn: () => void) => {
  if (enabled()) setTimeout(fn, ms);
};

const buyerLines = [
  'Hi! Is this still available? I could come by today.',
  'Perfect, that works. I will bring a friend to help carry it.',
  'Leaving now. I will have my code scanner ready when I get there.',
  'Thank you so much, this is going to get a lot of use.',
];

const sellerLines = [
  'It is yours. I am home after 4 today, or I can leave it on the porch.',
  'Sounds good, see you then.',
  'Great. Message me here if you get lost, the gate sticks a little.',
  'Enjoy it!',
];

const replies = new Map<string, number>();

function say(conversationId: string, senderId: string, lines: string[]) {
  const n = replies.get(conversationId) ?? 0;
  const line = lines[Math.min(n, lines.length - 1)];
  replies.set(conversationId, n + 1);
  if (line) useStore.getState().sendMessage(conversationId, line, senderId);
}

/** You published something. A neighbor notices. */
export function afterPublish(listingId: string) {
  later(5200, () => {
    const s = useStore.getState();
    const listing = s.listings.find((l) => l.id === listingId);
    if (!listing || listing.status !== 'available') return;
    s.claim(listingId, 'We just moved in two blocks away and this would be perfect.', DEMO_NEIGHBOR);
    if (listing.mode === 'owner_picks') {
      later(3800, () => useStore.getState().claim(listingId, 'I can pick up any evening this week.', 'u_kenji'));
      return;
    }
    greetAsBuyer(listingId);
  });
}

function greetAsBuyer(listingId: string) {
  later(1400, () => {
    const conv = useStore.getState().conversations.find((c) => c.listingId === listingId);
    if (conv && conv.buyerId !== useStore.getState().meId) say(conv.id, conv.buyerId, buyerLines);
  });
}

/** You picked someone from the queue. They say hello. */
export function afterConfirm(listingId: string) {
  greetAsBuyer(listingId);
}

/** You claimed a neighbor's listing. */
export function afterMyClaim(listingId: string) {
  const s = useStore.getState();
  const listing = s.listings.find((l) => l.id === listingId);
  if (!listing) return;
  const greet = () =>
    later(1600, () => {
      const st = useStore.getState();
      const conv = st.conversations.find((c) => c.listingId === listingId && c.buyerId === st.meId);
      if (conv) say(conv.id, conv.sellerId, sellerLines);
    });
  if (listing.mode === 'first_come') {
    greet();
    return;
  }
  later(4200, () => {
    const st = useStore.getState();
    const mine = st.claims.find((c) => c.listingId === listingId && c.userId === st.meId && c.status === 'waiting');
    if (mine && st.confirmClaim(mine.id)) greet();
  });
}

/** You sent a chat message. The other person answers after a beat. */
export function afterMyMessage(conversationId: string) {
  later(1900 + Math.random() * 900, () => {
    const s = useStore.getState();
    const conv = s.conversations.find((c) => c.id === conversationId);
    if (!conv) return;
    const iAmSeller = conv.sellerId === s.meId;
    say(conv.id, iAmSeller ? conv.buyerId : conv.sellerId, iAmSeller ? buyerLines : sellerLines);
  });
}
