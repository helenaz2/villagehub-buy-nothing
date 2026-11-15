import { getSupabase } from '@/lib/supabase';
import type { Person } from '@/types/listing';
import { backendConfig } from '@/lib/backend-config';
import { getRatingStats } from './ratings';

export type ProfileRow = { id: string; full_name: string; username: string; bio: string; city: string; state: string; created_at: string };
const publicFields = 'id,full_name,username,bio,city,state,created_at';
export function profileToPerson(row: ProfileRow): Person {
  return { id: row.id, name: row.full_name, handle: '@' + row.username, bio: row.bio, city: row.city, neighborhood: row.city, state: row.state, avatar: '', rating: 0, memberSince: row.created_at.slice(0, 4), monthsHere: 0 };
}
export async function fetchProfile(id: string): Promise<Person | null> {
  const { data, error } = await getSupabase().from('profiles').select(publicFields).eq('id', id).maybeSingle();
  if (error) throw error;
  if(!data) return null;
  const person=profileToPerson(data as ProfileRow);
  if(backendConfig.ratings) person.rating=Number((await getRatingStats([id]))[0]?.average_rating??0);
  return person;
}
export async function saveProfile(id: string, values: { name: string; city: string; state: string; bio?: string }) {
  // RLS checks auth.uid(); this id is not an authorization mechanism.
  const existing = await fetchProfile(id);
  const patch = { full_name: values.name.trim(), city: values.city.trim(), state: values.state, bio: values.bio ?? '' };
  const { data, error } = existing
    ? await getSupabase().from('profiles').update(patch).eq('id', id).select(publicFields).single()
    : await getSupabase().from('profiles').insert({ id, ...patch, username: 'member_' + id.replaceAll('-', '') }).select(publicFields).single();
  if (error) throw error;
  return profileToPerson(data as ProfileRow);
}
export async function fetchAddress(id: string) {
  const { data, error } = await getSupabase().from('account_addresses').select('street').eq('user_id', id).maybeSingle();
  if (error) throw error;
  return data?.street ?? '';
}
export async function saveStreet(id: string, street: string) {
  const { data, error: readError } = await getSupabase().from('account_addresses').select('user_id').eq('user_id', id).maybeSingle();
  if (readError) throw readError;
  const result = data
    ? await getSupabase().from('account_addresses').update({ street: street.trim() || null }).eq('user_id', id)
    : await getSupabase().from('account_addresses').insert({ user_id: id, street: street.trim() || null });
  if (result.error) throw result.error;
}
