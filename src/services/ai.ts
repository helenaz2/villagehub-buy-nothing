import { getSupabase } from '@/lib/supabase';
import type { CategoryProposalResult } from '@/lib/category-proposals';
import type { CategoryProposal, PhotoSuggestion } from '@/types/ai';

export async function invokeAI<T>(name:string,body:unknown):Promise<T>{
  const {data,error}=await getSupabase().functions.invoke(name,{body:body as Record<string,unknown>});
  if(error){
    let message='AI service unavailable. Please try again later.';
    if(error.context instanceof Response) try {const body=await error.context.json();if(typeof body.message==='string')message=body.message;}catch{/* Use a safe fallback for gateway errors. */}
    throw new Error(message);
  }
  return data as T;
}
export async function createProposal(name:string,reason:string,key:string){
 const {data,error}=await getSupabase().rpc('create_category_proposal',{p_name:name,p_reason:reason,p_client_key:key});if(error)throw new Error(error.message);
 return data as CategoryProposal;
}
const proposalListeners=new Set<()=>void>();
export function onProposalReviewed(listener:()=>void){proposalListeners.add(listener);return ()=>{proposalListeners.delete(listener);};}
export async function reviewProposal(id:string){const result=await invokeAI<CategoryProposalResult>('category-review',{proposalId:id});proposalListeners.forEach(listener=>listener());return result;}
export async function getProposals(limit=10){
 const {data,error}=await getSupabase().from('category_proposals').select('id,name,status,message,created_at,reviewed_at').order('created_at',{ascending:false}).limit(Math.min(50,limit));if(error)throw new Error(error.message);return data as CategoryProposal[];
}
export async function suggestPhoto(image:string,key:string){return invokeAI<PhotoSuggestion>('photo-autofill',{image,requestKey:key});}
export function subscribeCategories(userId:string,refresh:()=>void){
 const client=getSupabase();const channel=client.channel('categories:'+userId)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'categories'},refresh)
  .on('postgres_changes',{event:'UPDATE',schema:'public',table:'categories'},refresh)
  .on('system',{},payload=>{if(payload.extension==='postgres_changes'&&payload.status==='ok')refresh();}).subscribe();
 return ()=>{void client.removeChannel(channel);};
}
