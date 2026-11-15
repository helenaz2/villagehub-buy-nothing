import { useContext, useMemo, useState, type ReactNode } from 'react';

import { backendConfig } from '@/lib/backend-config';
import { LiveStoreProvider } from './live-store';
import { CATEGORIES } from '@/types/listing';
import { reviewCategoryProposal } from '@/lib/category-proposals';
import { hostReply } from '@/lib/replies';
import { StoreContext, type Store } from './store-context';
import type { ChatMessage, Conversation, Draft, Item, Person } from '@/types/listing';

import { initialConversations, initialItems, initialMe, people } from './seed';


function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function messageId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  return backendConfig.demo ? <DemoStoreProvider>{children}</DemoStoreProvider> : <LiveStoreProvider>{children}</LiveStoreProvider>;
}

function DemoStoreProvider({ children }: { children: ReactNode }) {
  const [accountAddress, setAccountAddress] = useState<{ street: string; state: string } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [categories, setCategories] = useState<string[]>([...CATEGORIES]);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [me, setMe] = useState<Person>(initialMe);
  const [savedIds, setSavedIds] = useState<string[]>(['plant']);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [draft, setDraft] = useState<Draft | null>(null);

  const value = useMemo<Store>(() => {
    return {
      feedItems: items, feedLoading: false, hasMoreListings: false, moreOwn: false, moreSaved: false,
      fetchFeed: async () => {}, refreshListing: async () => {}, loadOwnListings: async () => {}, loadSavedListings: async () => {},
      operationError: null, dismissOperationError: () => {},
      loading: false, storeError: null, retry: () => {},
      accountAddress,
      signedIn,
      // Backend auth belongs here: replace the demo session with verified tokens.
      startDemoSession: profile => {
        setMe(profile ? { ...initialMe, id: 'demo_member', name: profile.name, neighborhood: profile.city, city: profile.city, state: profile.state, handle: '@' + profile.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0,24), bio: 'New to the neighborhood. Ready to share.', rating: 0, memberSince: String(new Date().getFullYear()), monthsHere: 0 } : initialMe);
        setSavedIds(profile ? [] : ['plant']);
        setConversations(profile ? [] : initialConversations);
        setAccountAddress(profile ? { street: profile.street ?? '', state: profile.state } : null);
        setSignedIn(true);
      },
      signOut: () => { setAccountAddress(null); setSignedIn(false); setItems(initialItems); setSavedIds(['plant']); setConversations(initialConversations); setDraft(null); setMe(initialMe); },
      categories,
      reloadCategories:async () => {},
      proposeCategory: async (name, reason) => {
        const result = await reviewCategoryProposal({ name, reason, proposedBy: me.id });
        if (result.status === 'approved') setCategories(current => current.some(c => c.toLowerCase() === result.name.toLowerCase()) ? current : [...current.filter(c => c !== 'Other'), result.name, ...current.filter(c => c === 'Other')]);
        return result;
      },
      items,
      people,
      me,
      savedIds,
      conversations,
      loadInbox:async () => {},loadThread:async () => {},moreInbox:false,messagingStatus:null,
      draft,
      person: (id: string) => (id === me.id ? me : id === initialMe.id ? initialMe : people.find((person) => person.id === id)),
      toggleSave: (id: string) => {
        setSavedIds((current) => (current.includes(id) ? current.filter((saved) => saved !== id) : [...current, id]));
        setItems((current) =>
          current.map((item) => {
            if (item.id !== id) return item;
            const saved = savedIds.includes(id);
            return { ...item, saves: Math.max(0, item.saves + (saved ? -1 : 1)) };
          }),
        );
      },
      publish: (item: Item) => {
        setItems((current) => [item, ...current]);
        setDraft(null);
      },
      updateItem: (id, patch) => setItems(current => current.map(item => item.id === id && item.hostId === me.id ? { ...item, ...patch, id: item.id, hostId: item.hostId } : item)),
      deleteConversation: id => setConversations(current => current.filter(c => c.id !== id)),
      togglePin: id => setConversations(current => current.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c)),
      setUnread: (id, unread) => setConversations(current => current.map(c => c.id === id ? { ...c, unread } : c)),
      claim: (id: string) => {
        setItems((current) => current.map((item) => (item.id === id ? { ...item, status: 'claimed' } : item)));
      },
      relist: (id: string) => {
        setItems((current) => current.map((item) => (item.id === id ? { ...item, status: 'available', postedLabel: 'Just now' } : item)));
      },
      removeItem: (id: string) => {
        setItems((current) => current.filter((item) => item.id !== id));
        setSavedIds((current) => current.filter((saved) => saved !== id));
      },
      saveDraft: (next: Draft) => setDraft(next),
      clearDraft: () => setDraft(null),
      updateMe: (patch: Partial<Person>) => setMe((current) => ({ ...current, ...patch })),
      openThread: (itemId: string) => {
        const existing = conversations.find((conversation) => conversation.itemId === itemId);
        if (existing) return existing.id;
        const id = `c_${itemId}`;
        setConversations((current) => [{ id, itemId, messages: [], unread: false }, ...current]);
        return id;
      },
      sendMessage: (conversationId: string, text: string) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const mine: ChatMessage = { id: messageId(), sender: 'me', text: trimmed, time: nowLabel(), sentAt: Date.now() };
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? { ...conversation, unread: false, messages: [...conversation.messages, mine] }
              : conversation,
          ),
        );
        const conversation = conversations.find((entry) => entry.id === conversationId);
        const item = items.find((entry) => entry.id === conversation?.itemId);
        if (!item) return;
        const reply = hostReply(trimmed, item);
        setTimeout(() => {
          const theirs: ChatMessage = { id: messageId(), sender: 'them', text: reply, time: nowLabel(), sentAt: Date.now() };
          setConversations((current) =>
            current.map((entry) =>
              entry.id === conversationId ? { ...entry, unread: true, messages: [...entry.messages, theirs] } : entry,
            ),
          );
        }, 700);
      },
      ratingFor: personId => {
        const received = conversations.flatMap(c => {
          const host = items.find(i => i.id === c.itemId)?.hostId;
          const other = c.participantId ?? (host !== me.id ? host : undefined);
          if (!other) return [];
          const author = personId === me.id ? other : personId === other ? me.id : undefined;
          return author && c.ratings?.[author] ? [c.ratings[author]] : [];
        });
        return received.length ? received.reduce((a,b) => a+b,0) / received.length : (personId === me.id ? me.rating : people.find(p => p.id === personId)?.rating ?? 0);
      },
      rateConversation: (id, stars) => {
        if (!Number.isInteger(stars) || stars < 1 || stars > 5) return;
        setConversations(current => current.map(c => {
          const host = items.find(i => i.id === c.itemId)?.hostId;
          const other = c.participantId ?? (host !== me.id ? host : undefined);
          if (c.id !== id || !other || other === me.id || c.ratings?.[me.id] || !c.messages.some(m => m.sender === 'me') || !c.messages.some(m => m.sender === 'them')) return c;
          return { ...c, ratings: { ...c.ratings, [me.id]: stars } };
        }));
      },
      dismissRating: id => setConversations(current => current.map(c => c.id === id ? { ...c, ratingDismissedBy: [...new Set([...(c.ratingDismissedBy ?? []), me.id])] } : c)),
      markRead: (conversationId: string) => {
        setConversations((current) =>
          current.map((conversation) => (conversation.id === conversationId ? { ...conversation, unread: false } : conversation)),
        );
      },
    };
  }, [accountAddress, signedIn, categories, conversations, draft, items, me, savedIds]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}
