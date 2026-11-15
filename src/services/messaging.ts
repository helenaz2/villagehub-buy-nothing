import { getSupabase } from '@/lib/supabase';
import type { ChatMessage, Conversation } from '@/types/listing';
import { backendConfig } from '@/lib/backend-config';

export const MESSAGE_PAGE_SIZE = 30;
export type ThreadRow = { id: string; listing_id: string | null; listing_title: string; host_id: string; requester_id: string; last_message_at: string | null; last_sequence: number; last_sender_id: string | null; preview: string };
type MemberRow = { pinned: boolean; hidden: boolean; last_read_sequence: number; unread_override: boolean | null };
const columns='id,listing_id,listing_title,host_id,requester_id,last_message_at,last_sequence,last_sender_id,preview';
export function mapThread(row: ThreadRow, member: MemberRow, userId: string): Conversation {
  return { id:row.id,itemId:row.listing_id ?? '',title:row.listing_title,participantId:row.host_id===userId ? row.requester_id : row.host_id,messages:[],pinned:member.pinned,hidden:member.hidden,
    unread:member.unread_override ?? (row.last_sequence>member.last_read_sequence && row.last_sender_id!==userId),lastSequence:row.last_sequence,preview:row.preview,lastMessageAt:row.last_message_at ? Date.parse(row.last_message_at) : undefined };
}
export async function getInbox(userId: string,limit=30) {
  const {data,error}=await getSupabase().from('conversation_members').select(`pinned,hidden,last_read_sequence,unread_override,conversations!inner(${columns})`).eq('user_id',userId).eq('hidden',false).order('conversations(last_message_at)',{ascending:false,nullsFirst:false}).limit(limit);
  if(error) throw error;
  return (data as unknown as (MemberRow & {conversations:ThreadRow})[]).map(row=>mapThread(row.conversations,row,userId));
}
export async function getThread(id: string,userId: string) {
  const client=getSupabase();
  const [thread,member]=await Promise.all([client.from('conversations').select(columns).eq('id',id).maybeSingle(),client.from('conversation_members').select('pinned,hidden,last_read_sequence,unread_override').eq('conversation_id',id).eq('user_id',userId).maybeSingle()]);
  if(thread.error) throw thread.error; if(member.error) throw member.error;
  return thread.data && member.data ? mapThread(thread.data,member.data,userId) : null;
}
export async function getMessages(id: string,userId: string,before?: number): Promise<ChatMessage[]> {
  let query=getSupabase().from('messages').select('id,sender_id,body,created_at,sequence').eq('conversation_id',id).order('sequence',{ascending:false}).limit(MESSAGE_PAGE_SIZE);
  if(before!==undefined) query=query.lt('sequence',before);
  const {data,error}=await query; if(error) throw error;
  return data.reverse().map(row=>({id:row.id,sender:row.sender_id===userId?'me':'them',text:row.body,sentAt:Date.parse(row.created_at),time:new Date(row.created_at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),sequence:row.sequence}));
}
export async function openThread(listingId: string): Promise<string> {
  const {data,error}=await getSupabase().rpc('open_conversation',{p_listing_id:listingId}); if(error) throw error; return data;
}
export async function sendMessage(id: string,text: string,clientKey: string) {
  const {error}=await getSupabase().rpc('send_message',{p_conversation_id:id,p_body:text,p_client_key:clientKey}); if(error) throw error;
}
export async function setPreferences(id: string,userId: string,patch: {pinned?:boolean;hidden?:boolean;unread_override?:boolean|null}) {
  const {error}=await getSupabase().from('conversation_members').update(patch).eq('conversation_id',id).eq('user_id',userId); if(error) throw error;
}
export async function markRead(id: string,sequence: number) {
  const {error}=await getSupabase().rpc('mark_conversation_read',{p_conversation_id:id,p_sequence:sequence}); if(error) throw error;
}
export function subscribeInbox(userId: string,refresh:()=>void,onStatus:(status:string)=>void) {
  const client=getSupabase();
  const channel=client.channel(`inbox:${userId}`)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'conversations'},refresh)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'conversations'},refresh)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'conversation_members',filter:`user_id=eq.${userId}`},refresh);
  if(backendConfig.ratings) channel
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'rating_invitations',filter:`user_id=eq.${userId}`},refresh)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'rating_invitations',filter:`user_id=eq.${userId}`},refresh)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'ratings'},refresh);
  channel.on('system',{},payload=>{if(payload.extension==='postgres_changes' && payload.status==='ok') onStatus('SUBSCRIBED');})
    .subscribe(status=>{if(status!=='SUBSCRIBED') onStatus(status);});
  return ()=>{ void client.removeChannel(channel); };
}
