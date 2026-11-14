import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ScanOutcome } from '@/ai/scan';
import { config, syncedBackend } from '@/lib/config';
import { firstName, uid } from '@/lib/format';
import { estimateImpact } from '@/lib/impact';

import * as remote from './remote';
import type { ScanItem } from './schema';
import { buildSeed } from './seed/listings';
import { ME, seedUsers } from './seed/people';
import type {
  Category,
  Claim,
  ClaimMode,
  Conversation,
  Handoff,
  ImpactEvent,
  Listing,
  Message,
  Review,
  User,
  WantedPost,
} from './types';

export type Draft = {
  photos: string[];
  item: ScanItem;
  /** The untouched AI output, so the edit screen can show what changed. */
  original: ScanItem;
  /** Other items found in the same photo that the user still wants to list. */
  remaining: ScanItem[];
  source: ScanOutcome['source'];
  latencyMs: number;
  mode: ClaimMode;
  availableToday: boolean;
};

export type ScanLogEntry = {
  at: number;
  source: ScanOutcome['source'];
  latencyMs: number;
  fallbackReason: string | null;
  items: number;
};

type Data = {
  seededAt: number;
  onboarded: boolean;
  meId: string;
  users: User[];
  listings: Listing[];
  claims: Claim[];
  conversations: Conversation[];
  messages: Message[];
  handoffs: Handoff[];
  reviews: Review[];
  impact: ImpactEvent[];
  wanted: WantedPost[];
  scanLog: ScanLogEntry[];
  debug: boolean;
  draft: Draft | null;
  /** Bumped when a listing is published, so the browse feed can scroll to top. */
  lastPublishedId: string | null;
};

type Actions = {
  reset: () => void;
  finishOnboarding: () => void;
  setMe: (id: string) => void;
  toggleDebug: () => void;
  logScan: (entry: ScanLogEntry) => void;
  startDraft: (outcome: ScanOutcome, photoUri: string, picked?: number[]) => void;
  patchDraft: (patch: Partial<ScanItem>) => void;
  patchDraftMeta: (patch: Partial<Pick<Draft, 'mode' | 'availableToday' | 'photos'>>) => void;
  clearDraft: () => void;
  publishDraft: () => string | null;
  claim: (listingId: string, note: string, userId?: string) => Claim | null;
  confirmClaim: (claimId: string) => Conversation | null;
  withdrawClaim: (claimId: string) => void;
  sendMessage: (conversationId: string, body: string, senderId?: string) => void;
  receiveMessage: (message: Message) => void;
  setPickup: (conversationId: string, patch: Partial<Pick<Conversation, 'pickupAt' | 'porch' | 'meetSpot'>>) => void;
  completeHandoff: (token: string) => Handoff | null;
  rate: (handoffId: string, toId: string, stars: number) => void;
  logRehome: (input: { title: string; category: Category; item: ScanItem; kind: 'donated' | 'recycled' }) => void;
  addWanted: (text: string, category: Category) => void;
  mergeRemoteListings: (listings: Listing[]) => void;
};

export type Store = Data & Actions;

function fresh(): Data {
  const now = Date.now();
  const seed = buildSeed(now);
  return {
    seededAt: now,
    onboarded: false,
    meId: ME,
    users: seedUsers,
    listings: seed.listings,
    claims: seed.claims,
    conversations: seed.conversations,
    messages: seed.messages,
    handoffs: [
      { id: 'h_lamp', listingId: 'l_lamp', conversationId: 'cv_lamp', token: 'CURB-LAMP-7Q2M', status: 'pending', completedAt: null },
    ],
    reviews: [],
    impact: seed.impact,
    wanted: seed.wanted,
    scanLog: [],
    debug: false,
    draft: null,
    lastPublishedId: null,
  };
}

const token = () => `CURB-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/** Blur a point to roughly a block so it is safe to show on a map. */
function blur(lat: number, lng: number) {
  const j = () => (Math.random() - 0.5) * 0.004;
  return { lat: lat + j(), lng: lng + j() };
}

export const MY_DEMO_ADDRESS = '2536 Channing Way, Apt 2';

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...fresh(),

      reset: () => set({ ...fresh(), onboarded: true }),
      finishOnboarding: () => set({ onboarded: true }),
      setMe: (id) => set({ meId: id }),
      toggleDebug: () => set((s) => ({ debug: !s.debug })),
      logScan: (entry) => set((s) => ({ scanLog: [entry, ...s.scanLog].slice(0, 20) })),

      startDraft: (outcome, photoUri, picked) => {
        const items = outcome.result.items;
        const chosen = picked && picked.length > 0 ? picked.map((i) => items[i]).filter((x): x is ScanItem => !!x) : items.slice(0, 1);
        const [first, ...rest] = chosen;
        if (!first) return;
        set({
          draft: {
            photos: [photoUri],
            item: first,
            original: first,
            remaining: rest,
            source: outcome.source,
            latencyMs: outcome.latencyMs,
            mode: 'first_come',
            availableToday: true,
          },
        });
      },

      patchDraft: (patch) =>
        set((s) => (s.draft ? { draft: { ...s.draft, item: { ...s.draft.item, ...patch } } } : {})),

      patchDraftMeta: (patch) => set((s) => (s.draft ? { draft: { ...s.draft, ...patch } } : {})),

      clearDraft: () => set({ draft: null }),

      publishDraft: () => {
        const { draft, meId, users } = get();
        if (!draft) return null;
        const me = users.find((u) => u.id === meId);
        const it = draft.item;
        const listing: Listing = {
          id: uid('l'),
          ownerId: meId,
          title: it.name,
          category: it.category,
          subcategory: it.subcategory,
          color: it.color,
          material: it.material,
          condition: it.condition,
          dims: it.dimensions_in,
          brand: it.brand,
          description: it.description,
          tags: it.tags,
          pickup: it.pickup,
          weightClass: it.weight_class,
          priceUsd: it.action.kind === 'sell' ? (it.action.price_usd ?? 0) : 0,
          estValueUsd: it.est_value_usd,
          photos: draft.photos,
          neighborhood: me?.neighborhood ?? config.regionName,
          approx: blur(config.region.lat, config.region.lng),
          address: MY_DEMO_ADDRESS,
          mode: draft.mode,
          status: 'available',
          availableToday: draft.availableToday,
          createdAt: Date.now(),
        };
        const [next, ...rest] = draft.remaining;
        set((s) => ({
          listings: [listing, ...s.listings],
          lastPublishedId: listing.id,
          // In multi-item mode, move straight on to the next item from the same photo.
          draft: next ? { ...draft, item: next, original: next, remaining: rest } : null,
        }));
        if (syncedBackend) void remote.publishListing(listing);
        return listing.id;
      },

      claim: (listingId, note, userId) => {
        const s = get();
        const who = userId ?? s.meId;
        const listing = s.listings.find((l) => l.id === listingId);
        if (!listing || listing.status !== 'available' || listing.ownerId === who) return null;
        if (s.claims.some((c) => c.listingId === listingId && c.userId === who && c.status !== 'passed')) return null;
        const claim: Claim = { id: uid('c'), listingId, userId: who, note, status: 'waiting', createdAt: Date.now() };
        set({ claims: [...s.claims, claim] });
        if (syncedBackend) void remote.insertClaim(claim);
        // First come, first served: the first claim is confirmed on the spot.
        if (listing.mode === 'first_come') get().confirmClaim(claim.id);
        return claim;
      },

      confirmClaim: (claimId) => {
        const s = get();
        const claim = s.claims.find((c) => c.id === claimId);
        const listing = claim && s.listings.find((l) => l.id === claim.listingId);
        if (!claim || !listing || listing.status !== 'available') return null;
        const seller = s.users.find((u) => u.id === listing.ownerId);
        const conversation: Conversation = {
          id: uid('cv'),
          listingId: listing.id,
          buyerId: claim.userId,
          sellerId: listing.ownerId,
          pickupAt: null,
          porch: false,
          meetSpot: null,
        };
        const hello: Message = {
          id: uid('m'),
          conversationId: conversation.id,
          senderId: 'system',
          body: `${firstName(seller?.name ?? 'The owner')} confirmed the claim. Pickup address: ${listing.address}.`,
          createdAt: Date.now(),
        };
        const handoff: Handoff = {
          id: uid('h'),
          listingId: listing.id,
          conversationId: conversation.id,
          token: token(),
          status: 'pending',
          completedAt: null,
        };
        set({
          claims: s.claims.map((c) =>
            c.listingId !== listing.id ? c : { ...c, status: c.id === claimId ? 'confirmed' : 'passed' },
          ),
          listings: s.listings.map((l) => (l.id === listing.id ? { ...l, status: 'pending' } : l)),
          conversations: [conversation, ...s.conversations],
          messages: [...s.messages, hello],
          handoffs: [...s.handoffs, handoff],
        });
        if (syncedBackend) void remote.confirmClaim(claimId);
        return conversation;
      },

      withdrawClaim: (claimId) =>
        set((s) => ({ claims: s.claims.filter((c) => c.id !== claimId || c.status === 'confirmed') })),

      sendMessage: (conversationId, body, senderId) => {
        const text = body.trim();
        if (!text) return;
        const message: Message = {
          id: uid('m'),
          conversationId,
          senderId: senderId ?? get().meId,
          body: text,
          createdAt: Date.now(),
        };
        set((s) => ({ messages: [...s.messages, message] }));
        if (syncedBackend && message.senderId === get().meId) void remote.sendMessage(message);
      },

      receiveMessage: (message) =>
        set((s) => (s.messages.some((m) => m.id === message.id) ? {} : { messages: [...s.messages, message] })),

      setPickup: (conversationId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, ...patch } : c)),
        })),

      completeHandoff: (tok) => {
        const s = get();
        const handoff = s.handoffs.find((h) => h.token === tok.trim().toUpperCase());
        if (!handoff) return null;
        if (handoff.status === 'done') return handoff;
        const listing = s.listings.find((l) => l.id === handoff.listingId);
        if (!listing) return null;
        const done: Handoff = { ...handoff, status: 'done', completedAt: Date.now() };
        const est = estimateImpact(listing);
        const event: ImpactEvent = {
          id: uid('i'),
          userId: listing.ownerId,
          listingId: listing.id,
          kind: 'rehomed',
          title: listing.title,
          ...est,
          at: Date.now(),
        };
        const note: Message = {
          id: uid('m'),
          conversationId: handoff.conversationId,
          senderId: 'system',
          body:
            listing.priceUsd > 0
              ? `Handoff confirmed. The $${listing.priceUsd} payment was released to the seller.`
              : 'Handoff confirmed. One more thing kept out of the landfill.',
          createdAt: Date.now(),
        };
        set({
          handoffs: s.handoffs.map((h) => (h.id === handoff.id ? done : h)),
          listings: s.listings.map((l) => (l.id === listing.id ? { ...l, status: 'given' } : l)),
          impact: [...s.impact, event],
          messages: [...s.messages, note],
          users: s.users.map((u) =>
            u.id === listing.ownerId ? { ...u, handoffs: u.handoffs + 1 } : u,
          ),
        });
        if (syncedBackend) void remote.completeHandoff(done.token);
        return done;
      },

      rate: (handoffId, toId, stars) =>
        set((s) => ({
          reviews: [
            ...s.reviews.filter((r) => !(r.handoffId === handoffId && r.fromId === s.meId)),
            { id: uid('r'), handoffId, fromId: s.meId, toId, stars },
          ],
        })),

      logRehome: ({ title, category, item, kind }) =>
        set((s) => {
          const est = estimateImpact({
            category,
            weightClass: item.weight_class,
            estValueUsd: kind === 'donated' ? item.est_value_usd : 0,
            priceUsd: 0,
          });
          // Recycling recovers material but does not replace a new product, so we count weight only.
          const co2Kg = kind === 'donated' ? est.co2Kg : 0;
          return {
            impact: [
              ...s.impact,
              { id: uid('i'), userId: s.meId, listingId: null, kind, title, lbs: est.lbs, co2Kg, savedUsd: est.savedUsd, at: Date.now() },
            ],
          };
        }),

      addWanted: (text, category) =>
        set((s) => ({
          wanted: [{ id: uid('w'), userId: s.meId, text: text.trim(), category, createdAt: Date.now() }, ...s.wanted],
        })),

      mergeRemoteListings: (incoming) =>
        set((s) => {
          const known = new Set(s.listings.map((l) => l.id));
          const added = incoming.filter((l) => !known.has(l.id));
          return added.length ? { listings: [...added, ...s.listings] } : {};
        }),
    }),
    {
      name: 'curbside-v1',
      storage: createJSONStorage(() => AsyncStorage),
      // The draft holds a temp photo path and should not survive a restart.
      partialize: ({ draft: _draft, ...rest }) => rest,
    },
  ),
);

export const useMe = () => useStore((s) => s.users.find((u) => u.id === s.meId) ?? s.users[0]!);
export const useUser = (id: string | undefined) => useStore((s) => s.users.find((u) => u.id === id));
export const useListing = (id: string | undefined) => useStore((s) => s.listings.find((l) => l.id === id));
