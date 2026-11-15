import { getSupabase } from '@/lib/supabase';
import { readPhoto } from '@/lib/photo-bytes';
import type { Item } from '@/types/listing';

export const PAGE_SIZE = 20;
type PhotoRow = { object_path: string; position: number };
type ListingRow = { id: string; owner_id: string; title: string; description: string; condition: Item['condition']; condition_note: string; size: string; color: string; neighborhood: string; city: string; tags: string[]; features: string[]; materials: string; fabric: string; status: Item['status']; created_at: string; categories: { name: string }; listing_photos: PhotoRow[] };
const columns = 'id,owner_id,title,description,condition,condition_note,size,color,neighborhood,city,tags,features,materials,fabric,status,created_at,categories(name),listing_photos(object_path,position)';
const bucket = 'listing-photos';
export async function getCategories() {
  const { data, error } = await getSupabase().from('categories').select('id,name').order('sort_order').order('name');
  if (error) throw error;
  return data as { id: string; name: string }[];
}
export async function hydrateListing(row: ListingRow): Promise<Item> {
  const paths = [...row.listing_photos].sort((a,b) => a.position - b.position).map(p => p.object_path);
  const { data, error } = await getSupabase().storage.from(bucket).createSignedUrls(paths, 3600);
  if (error) throw error;
  if (data?.some(p => p.error || !p.signedUrl)) throw new Error('A listing photo could not be loaded. Please refresh.');
  return { id: row.id, hostId: row.owner_id, title: row.title, description: row.description, condition: row.condition, conditionNote: row.condition_note, size: row.size, color: row.color, neighborhood: row.neighborhood, city: row.city, tags: row.tags, features: row.features, materials: row.materials, fabric: row.fabric, status: row.status, category: row.categories.name, photos: data?.map(p => p.signedUrl as string) ?? [], photoPaths: paths, postedLabel: new Date(row.created_at).toLocaleDateString(), distance: '', saves: 0 };
}
export async function listListings({ query = '', category = 'For you', offset = 0, ownerId, savedOnly = false }: { query?: string; category?: string; offset?: number; ownerId?: string; savedOnly?: boolean } = {}) {
  const client = getSupabase();
  let ids: string[] | undefined;
  if (savedOnly) {
    const saved = await client.from('saved_items').select('listing_id');
    if (saved.error) throw saved.error;
    ids = saved.data.map(p => p.listing_id);
    if (!ids.length) return [];
  }
  let request = client.from('listings').select(columns).in('status', ['available','claimed']);
  if (ownerId) request = request.eq('owner_id', ownerId);
  else if (!savedOnly) request = request.eq('status','available');
  if (ids) request = request.in('id',ids);
  if (category !== 'For you') {
    const match = (await getCategories()).find(c => c.name === category);
    if (!match) return [];
    request = request.eq('category_id',match.id);
  }
  if (query.trim()) request = request.textSearch('search_document',query.trim(),{ type:'websearch', config:'english' });
  const { data, error } = await request.order('created_at',{ ascending:false }).order('id',{ ascending:false }).range(offset,offset+PAGE_SIZE-1);
  if (error) throw error;
  return Promise.all((data as unknown as ListingRow[]).map(hydrateListing));
}
export async function getListing(id: string): Promise<Item | null> {
  const { data, error } = await getSupabase().from('listings').select(columns).eq('id',id).neq('status','draft').maybeSingle();
  if (error) throw error;
  return data ? hydrateListing(data as unknown as ListingRow) : null;
}
export async function getSavedIds() {
  const { data, error } = await getSupabase().from('saved_items').select('listing_id');
  if (error) throw error;
  return data.map(row => row.listing_id as string);
}
export async function setSaved(userId: string, id: string, save: boolean) {
  const result = save
    ? await getSupabase().from('saved_items').upsert({ user_id:userId,listing_id:id },{ onConflict:'user_id,listing_id', ignoreDuplicates:true })
    : await getSupabase().from('saved_items').delete().eq('user_id',userId).eq('listing_id',id);
  if (result.error) throw result.error;
}
function listingValues(item: Item, categoryId: string) {
  return { title:item.title.trim(),description:item.description.trim(),category_id:categoryId,condition:item.condition,condition_note:item.conditionNote.trim(),size:item.size.trim(),color:item.color.trim(),neighborhood:item.neighborhood.trim(),city:item.city.trim(),tags:item.tags,features:item.features,materials:item.materials.trim(),fabric:item.fabric.trim() };
}
async function uploadPhoto(uri: string, ownerId: string, id: string) {
  const { bytes, mime } = await readPhoto(uri);
  const types: Record<string,string> = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/heic':'heic' };
  if (!types[mime]) throw new Error('Choose a JPEG, PNG, WebP, or HEIC photo.');
  if (bytes.byteLength > 10485760 || !bytes.byteLength) throw new Error('Each photo must be between 1 byte and 10 MB.');
  const path = `${ownerId}/${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${types[mime]}`;
  const { error } = await getSupabase().storage.from(bucket).upload(path,bytes,{ contentType:mime,upsert:false });
  if (error) throw error;
  return path;
}
export async function saveListing(item: Item, ownerId: string, existing?: Item): Promise<string> {
  const category = (await getCategories()).find(c => c.name === item.category);
  if (!category) throw new Error('Choose an approved category.');
  const client = getSupabase();
  let id = existing?.id;
  if (!id) {
    const created = await client.from('listings').insert({ ...listingValues(item,category.id),owner_id:ownerId }).select('id').single();
    if (created.error) throw created.error;
    id = created.data.id as string;
  }
  const uploaded: string[] = [];
  const paths: string[] = [];
  try {
    for (const uri of item.photos) {
      const index = existing?.photos.indexOf(uri) ?? -1;
      const oldPath = index >= 0 ? existing?.photoPaths?.[index] : undefined;
      const path = oldPath ?? await uploadPhoto(uri,ownerId,id);
      if (!oldPath) uploaded.push(path);
      paths.push(path);
    }
    const published = await client.rpc('publish_listing_photos',{ p_listing_id:id,p_paths:paths,p_details:listingValues(item,category.id) });
    if (published.error) throw published.error;
  } catch (error) {
    // Failed draft/upload remains unpublished; remove only files from this attempt.
    if (uploaded.length) await client.storage.from(bucket).remove(uploaded);
    if (!existing) await client.from('listings').delete().eq('id',id);
    throw error;
  }
  const removed = existing?.photoPaths?.filter(p => !paths.includes(p)) ?? [];
  if (removed.length) {
    const cleanup = await client.storage.from(bucket).remove(removed);
    if (cleanup.error) throw new Error('Post saved, but old photo cleanup failed. Refresh before editing again.');
  }
  return id;
}
export async function setListingStatus(id: string, status: Item['status']) {
  const { error } = await getSupabase().from('listings').update({ status }).eq('id',id).select('id').single();
  if (error) throw error;
}
export async function deleteListing(item: Item) {
  const deleted = await getSupabase().from('listings').delete().eq('id',item.id).select('id').single();
  if (deleted.error) throw deleted.error;
  if (item.photoPaths?.length) {
    const removed = await getSupabase().storage.from(bucket).remove(item.photoPaths);
    if (removed.error) throw new Error('Post deleted, but photo cleanup needs a retry.');
  }
}
