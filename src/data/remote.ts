import { config } from '@/lib/config';

import { supabase } from './supabase';
import type { Claim, Listing, Message } from './types';

/**
 * Write-through sync to Supabase. The app is local-first: every action lands
 * in the on-device store immediately, then these functions mirror it to the
 * backend when EXPO_PUBLIC_BACKEND=supabase.
 *
 * Status: written against supabase/migrations/0001_init.sql and type-checked,
 * but not yet exercised against a live project. Failures are logged and never
 * block the UI. See docs/LIMITATIONS.md.
 */

const warn = (what: string, error: unknown) =>
  console.warn(`[sync] ${what} failed:`, error instanceof Error ? error.message : error);

let sessionUserId: string | null = null;

export async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  if (sessionUserId) return sessionUserId;
  const existing = await supabase.auth.getSession();
  if (existing.data.session) {
    sessionUserId = existing.data.session.user.id;
    return sessionUserId;
  }
  // Anonymous sign-in keeps the demo to zero typing. Phone or .edu verification upgrades the same user.
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    warn('sign-in', error);
    return null;
  }
  sessionUserId = data.user.id;
  return sessionUserId;
}

const point = (lat: number, lng: number) => `SRID=4326;POINT(${lng} ${lat})`;

async function uploadPhoto(listingId: string, uri: string, position: number): Promise<string | null> {
  if (!supabase) return null;
  if (uri.startsWith('http')) return uri;
  const bytes = await (await fetch(uri)).arrayBuffer();
  const path = `${listingId}/${position}.jpg`;
  const { error } = await supabase.storage.from('listing-photos').upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;
}

export async function publishListing(listing: Listing): Promise<void> {
  try {
    const userId = await ensureSession();
    if (!supabase || !userId) return;
    const photoUrls: string[] = [];
    for (const [i, uri] of listing.photos.entries()) {
      const url = await uploadPhoto(listing.id, uri, i);
      if (url) photoUrls.push(url);
    }
    const { error } = await supabase.from('listings').insert({
      id: listing.id,
      owner_id: userId,
      title: listing.title,
      category: listing.category,
      subcategory: listing.subcategory,
      color: listing.color,
      material: listing.material,
      condition: listing.condition,
      dims: listing.dims,
      brand: listing.brand,
      description: listing.description,
      tags: listing.tags,
      pickup: listing.pickup,
      weight_class: listing.weightClass,
      price_usd: listing.priceUsd,
      est_value_usd: listing.estValueUsd,
      neighborhood: listing.neighborhood,
      approx: point(listing.approx.lat, listing.approx.lng),
      mode: listing.mode,
      available_today: listing.availableToday,
    });
    if (error) throw error;
    // The exact address lives in its own table, readable only by the owner and a confirmed claimant.
    await supabase.from('listing_private').insert({
      listing_id: listing.id,
      address: listing.address,
      exact: point(config.region.lat, config.region.lng),
    });
    if (photoUrls.length) {
      await supabase
        .from('listing_photos')
        .insert(photoUrls.map((url, position) => ({ listing_id: listing.id, url, position })));
    }
  } catch (e) {
    warn('publish listing', e);
  }
}

type NearbyRow = {
  id: string;
  owner_id: string;
  title: string;
  category: Listing['category'];
  subcategory: string;
  color: string;
  material: string;
  condition: Listing['condition'];
  dims: Listing['dims'];
  brand: string | null;
  description: string;
  tags: string[];
  pickup: Listing['pickup'];
  weight_class: Listing['weightClass'];
  price_usd: number;
  est_value_usd: number;
  neighborhood: string;
  approx_lat: number;
  approx_lng: number;
  mode: Listing['mode'];
  status: Listing['status'];
  available_today: boolean;
  created_at: string;
  photos: string[] | null;
};

export async function fetchNearby(radiusMeters = 8000): Promise<Listing[]> {
  try {
    if (!supabase) return [];
    await ensureSession();
    const { data, error } = await supabase.rpc('nearby_listings', {
      lat: config.region.lat,
      lng: config.region.lng,
      radius_m: radiusMeters,
    });
    if (error) throw error;
    return ((data ?? []) as NearbyRow[]).map((r) => ({
      id: r.id,
      ownerId: r.owner_id,
      title: r.title,
      category: r.category,
      subcategory: r.subcategory,
      color: r.color,
      material: r.material,
      condition: r.condition,
      dims: r.dims,
      brand: r.brand,
      description: r.description,
      tags: r.tags,
      pickup: r.pickup,
      weightClass: r.weight_class,
      priceUsd: r.price_usd,
      estValueUsd: r.est_value_usd,
      photos: r.photos ?? [],
      neighborhood: r.neighborhood,
      approx: { lat: r.approx_lat, lng: r.approx_lng },
      address: '',
      mode: r.mode,
      status: r.status,
      availableToday: r.available_today,
      createdAt: new Date(r.created_at).getTime(),
    }));
  } catch (e) {
    warn('fetch nearby', e);
    return [];
  }
}

export async function insertClaim(claim: Claim): Promise<void> {
  try {
    const userId = await ensureSession();
    if (!supabase || !userId) return;
    const { error } = await supabase
      .from('claims')
      .insert({ id: claim.id, listing_id: claim.listingId, user_id: userId, note: claim.note });
    if (error) throw error;
  } catch (e) {
    warn('claim', e);
  }
}

export async function confirmClaim(claimId: string): Promise<void> {
  try {
    if (!supabase) return;
    const { error } = await supabase.rpc('confirm_claim', { p_claim_id: claimId });
    if (error) throw error;
  } catch (e) {
    warn('confirm claim', e);
  }
}

export async function sendMessage(message: Message): Promise<void> {
  try {
    const userId = await ensureSession();
    if (!supabase || !userId) return;
    const { error } = await supabase.from('messages').insert({
      id: message.id,
      conversation_id: message.conversationId,
      sender_id: userId,
      body: message.body,
    });
    if (error) throw error;
  } catch (e) {
    warn('send message', e);
  }
}

export async function completeHandoff(token: string): Promise<void> {
  try {
    if (!supabase) return;
    const { error } = await supabase.rpc('complete_handoff', { p_token: token });
    if (error) throw error;
  } catch (e) {
    warn('complete handoff', e);
  }
}

/** Live chat. Returns an unsubscribe function. */
export function subscribeToMessages(conversationId: string, onMessage: (m: Message) => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const row = payload.new as { id: string; conversation_id: string; sender_id: string | null; body: string; created_at: string };
        onMessage({
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id ?? 'system',
          body: row.body,
          createdAt: new Date(row.created_at).getTime(),
        });
      },
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}
