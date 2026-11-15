import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { useStore } from './store';
import { backendConfig } from '@/lib/backend-config';
import { getProposals, onProposalReviewed } from '@/services/ai';
import type { CategoryProposal } from '@/types/ai';
import type { RecommendationReply } from '@/lib/recommendation-contract';
import type { RecommendationRequest } from '@/services/recommendations';

export type AssistantTurn={id:string;question:string;reply:RecommendationReply;createdAt:number};
function useAssistantState(){
 const {me}=useStore();const path=usePathname();
 const [turns,setTurns]=useState<AssistantTurn[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[canRetry,setCanRetry]=useState(false);
 const [notices,setNotices]=useState<CategoryProposal[]>([]),[noticeError,setNoticeError]=useState('');
 const pendingRef=useRef<RecommendationRequest|null>(null),inFlightRef=useRef(false);
 const [pendingQuestion,setPendingQuestion]=useState('');
 useEffect(()=>{
  if(backendConfig.demo||!backendConfig.ai||!me.id)return;
  let active=true,request=0;
  async function refresh(){const current=++request;try{const rows=await getProposals(50);if(active&&current===request){setNotices(rows.filter(p=>p.status!=='pending'));setNoticeError('');}}catch{if(active&&current===request)setNoticeError('Unable to load system messages. Reopen the assistant to retry.');}}
  void refresh();const unsubscribe=onProposalReviewed(()=>{void refresh();});
  const timer=setInterval(()=>{void refresh();},30000);
  return()=>{active=false;clearInterval(timer);unsubscribe();};
 },[me.id,path]);
 return {turns,setTurns,text,setText,busy,setBusy,error,setError,canRetry,setCanRetry,pendingRef,inFlightRef,pendingQuestion,setPendingQuestion,notices,noticeError};
}
const AssistantContext=createContext<ReturnType<typeof useAssistantState>|null>(null);
function AssistantState({children}:{children:ReactNode}){const value=useAssistantState();return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;}
export function AssistantProvider({children}:{children:ReactNode}){const {me}=useStore();return <AssistantState key={me.id} >{children}</AssistantState>;}
export function useAssistant(){const value=useContext(AssistantContext);if(!value)throw new Error('AssistantProvider required');return value;}
