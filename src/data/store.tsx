import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { CATEGORIES } from '@/types/listing';
import { reviewCategoryProposal, type CategoryProposalResult } from '@/lib/category-proposals';
import { hostReply } from '@/lib/replies';
import type { ChatMessage, Conversation, Draft, Item, Person } from '@/types/listing';

import { initialConversations, initialItems, initialMe, people } from './seed';

type Store = {
  categories: string[];
  proposeCategory: (name: string, reason: string) => Promise<CategoryProposalResult>;
  items: Item[];
  people: Person[];
  me: Person;
  savedIds: string[];
  conversations: Conversation[];
  draft: Draft | null;
  toggleSave: (id: string) => void;
  publish: (item: Item) => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  deleteConversation: (id: string) => void;
  togglePin: (id: string) => void;
  setUnread: (id: string, unread: boolean) => void;
  claim: (id: string) => void;
  relist: (id: string) => void;
  removeItem: (id: string) => void;
  saveDraft: (draft: Draft) => void;
  clearDraft: () => void;
  updateMe: (patch: Partial<Person>) => void;
  openThread: (itemId: string) => string;
  sendMessage: (conversationId: string, text: string) => void;
  rateConversation: (id: string, stars: number) => void;
  dismissRating: (id: string) => void;
  ratingFor: (personId: string) => number;
  markRead: (conversationId: string) => void;
  person: (id: string) => Person | undefined;
};

const StoreContext = createContext<Store | null>(null);

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function messageId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<string[]>([...CATEGORIES]);
  const [items, setItems] = useState<Item[]>(initialItems);
  const [me, setMe] = useState<Person>(initialMe);
  const [savedIds, setSavedIds] = useState<string[]>(['plant']);
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations);
  const [draft, setDraft] = useState<Draft | null>(null);

  const value = useMemo<Store>(() => {
    return {
      categories,
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
      draft,
      person: (id: string) => (id === me.id ? me : people.find((person) => person.id === id)),
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
  }, [categories, conversations, draft, items, me, savedIds]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}
