import { invokeAI } from './ai';
import { getListing } from './listings';
import { validateRecommendationReply, type RecommendationPlan, type RecommendationCard } from '@/lib/recommendation-contract';
export type RecommendationRequest={requestKey:string;messages:string[];previousPlan:RecommendationPlan|null};
export async function askRecommendations(body:RecommendationRequest){return validateRecommendationReply(await invokeAI<unknown>('listing-recommendations',body));}
export async function refreshRecommendations(ids:string[]):Promise<RecommendationCard[]>{
 const rows=await Promise.all(ids.slice(0,8).map(getListing));
 return rows.filter(row=>row?.status==='available').map(row=>({id:row!.id,title:row!.title,city:row!.city,neighborhood:row!.neighborhood,status:'available',imageUrl:row!.photos[0]??null}));
}
