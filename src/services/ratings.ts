import { getSupabase } from '@/lib/supabase';
import type { Conversation } from '@/types/listing';
type Invitation = {conversation_id:string;sequence:number;available_at:string|null;dismissed_at:string|null};
type Rating = {conversation_id:string;rater_id:string;stars:number};
export function applyRatingState(thread:Conversation,userId:string,invitations:Invitation[],ratings:Rating[]):Conversation {
  const invitation=invitations.find(i=>i.conversation_id===thread.id);
  const available=!!invitation?.available_at && invitation.sequence===thread.lastSequence;
  return {...thread,ratings:Object.fromEntries(ratings.filter(r=>r.conversation_id===thread.id).map(r=>[r.rater_id,r.stars])),ratingAvailableAt:available?Date.parse(invitation.available_at!):undefined,
    ratingDismissedBy:invitation?.dismissed_at?[userId]:[]};
}
export async function attachRatingState(threads:Conversation[],userId:string) {
  if(!threads.length) return threads;
  const client=getSupabase(),ids=threads.map(c=>c.id);
  const [invitations,ratings]=await Promise.all([client.from('rating_invitations').select('conversation_id,sequence,available_at,dismissed_at').in('conversation_id',ids).eq('user_id',userId),client.from('ratings').select('conversation_id,rater_id,stars').in('conversation_id',ids)]);
  if(invitations.error) throw invitations.error;if(ratings.error) throw ratings.error;
  return threads.map(c=>applyRatingState(c,userId,invitations.data,ratings.data));
}
export async function submitRating(id:string,stars:number) {
  const {error}=await getSupabase().rpc('submit_conversation_rating',{p_conversation_id:id,p_stars:stars});if(error) throw error;
}
export async function dismissRating(id:string) {
  const {error}=await getSupabase().rpc('dismiss_rating_invitation',{p_conversation_id:id});if(error) throw error;
}
export async function getRatingStats(ids:string[]) {
  const {data,error}=await getSupabase().rpc('get_rating_stats',{p_user_ids:ids});if(error) throw error;
  return data as {user_id:string;average_rating:number;rating_count:number}[];
}
