import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@/services/messaging';
import * as ratings from '@/services/ratings';
import { fetchProfile } from '@/services/profiles';
import { backendConfig } from '@/lib/backend-config';
import type { Conversation, Person } from '@/types/listing';

export function useLiveMessaging(userId: string | undefined, report: (message: string) => void) {
  const [threads,setThreads]=useState<{owner?:string;rows:Conversation[]}>({rows:[]});
  const [people,setPeople]=useState<{owner?:string;rows:Person[]}>({rows:[]});
  const [moreInbox,setMoreInbox]=useState(false);
  const [status,setStatus]=useState<string|null>(null);
  const owner=useRef(userId);
  const cache=useRef<Conversation[]>([]);
  const inboxIds=useRef<string[]>([]);
  const limit=useRef(30);
  const activeThread=useRef<string|null>(null);
  const inboxRequest=useRef(0);
  const threadRequests=useRef(new Map<string,number>());
  const current=useCallback(()=>owner.current===userId,[userId]);
  const fail=useCallback((e:unknown)=>{ if(current()) report(e instanceof Error ? e.message : (e as {message?:string})?.message ?? 'Unable to load messages.'); },[current,report]);
  const rememberPeople=useCallback(async (rows:Conversation[])=>{
    const ids=[...new Set(rows.map(c=>c.participantId).filter((id):id is string=>!!id))];
    const next=(await Promise.all(ids.map(fetchProfile))).filter((p):p is Person=>!!p);
    if(current()) setPeople(old=>({owner:userId,rows:[...next,...(old.owner===userId?old.rows:[]).filter(p=>!next.some(n=>n.id===p.id))]}));
  },[current,userId]);
  const commit=useCallback((next:Conversation[])=>{cache.current=next;setThreads({owner:userId,rows:next});},[userId]);
  const loadInbox=useCallback(async(more=false)=>{
    if(!userId || !backendConfig.messaging) return;
    const request=++inboxRequest.current;
    if(more) limit.current+=30;
    try {
      const inbox=await api.getInbox(userId,limit.current);
      const rows=backendConfig.ratings?await ratings.attachRatingState(inbox,userId):inbox;
      if(!current() || request!==inboxRequest.current) return;
      inboxIds.current=rows.map(c=>c.id);
      commit([...rows.map(c=>({...c,messages:cache.current.find(old=>old.id===c.id)?.messages??[],moreMessages:cache.current.find(old=>old.id===c.id)?.moreMessages})),...cache.current.filter(c=>!inboxIds.current.includes(c.id)).map(c=>({...c,hidden:true}))]);
      setMoreInbox(rows.length===limit.current);
      await rememberPeople(rows);
    } catch(e) {fail(e);}
  },[userId,current,commit,rememberPeople,fail]);
  const loadThread=useCallback(async(id:string,older=false)=>{
    if(!userId || !backendConfig.messaging) return;
    activeThread.current=id;
    const request=(threadRequests.current.get(id)??0)+1;
    threadRequests.current.set(id,request);
    const existing=cache.current.find(c=>c.id===id);
    const before=older ? existing?.messages[0]?.sequence : undefined;
    try {
      const [thread,messages]=await Promise.all([api.getThread(id,userId),api.getMessages(id,userId,before)]);
      const row=thread && backendConfig.ratings?(await ratings.attachRatingState([thread],userId))[0]:thread;
      if(!current() || threadRequests.current.get(id)!==request) return;
      if(!row) {commit(cache.current.filter(c=>c.id!==id));return;}
      const previous=cache.current.find(c=>c.id===id);
      const combined=[...messages,...(previous?.messages??[])].filter((m,i,all)=>all.findIndex(n=>n.id===m.id)===i).sort((a,b)=>(a.sequence??0)-(b.sequence??0));
      commit([{...row,messages:combined,moreMessages:older || !previous?.messages.length ? messages.length===api.MESSAGE_PAGE_SIZE : previous.moreMessages},...cache.current.filter(c=>c.id!==id)]);
      await rememberPeople([row]);
    } catch(e) {fail(e);}
  },[userId,current,commit,rememberPeople,fail]);
  useEffect(()=>{
    owner.current=userId;cache.current=[];inboxIds.current=[];activeThread.current=null;limit.current=30;inboxRequest.current++;threadRequests.current.clear();
    if(!userId || !backendConfig.messaging) return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const refresh=()=>{clearTimeout(timer);timer=setTimeout(()=>{void loadInbox();if(activeThread.current) void loadThread(activeThread.current);},100);};
    void loadInbox();
    const unsubscribe=api.subscribeInbox(userId,refresh,next=>{
      if(owner.current!==userId) return;
      if(next==='SUBSCRIBED') {setStatus(null);refresh();}
      else if(next==='CHANNEL_ERROR' || next==='TIMED_OUT' || next==='CLOSED') setStatus('Live updates disconnected. Refresh to check for new messages.');
    });
    return ()=>{owner.current=undefined;clearTimeout(timer);unsubscribe();};
  },[userId,loadInbox,loadThread]);
  const run=useCallback((action:()=>Promise<void>)=>{void action().catch(fail);},[fail]);
  const preferences=useCallback(async(id:string,patch:{pinned?:boolean;hidden?:boolean;unread_override?:boolean|null})=>{
    if(!userId) return; await api.setPreferences(id,userId,patch);await loadInbox();
  },[userId,loadInbox]);
  return {
    conversations:threads.owner===userId?threads.rows:[],people:people.owner===userId?people.rows:[],moreInbox:threads.owner===userId && moreInbox,loadInbox,loadThread,messagingStatus:threads.owner===userId?status:null,
    openThread:async(listingId:string)=>{const id=await api.openThread(listingId);await loadThread(id);await loadInbox();return id;},
    sendMessage:async(id:string,text:string,key?:string)=>{await api.sendMessage(id,text,key??`${Date.now()}-${Math.random().toString(36).slice(2)}`);await loadThread(id);await loadInbox();},
    deleteConversation:(id:string)=>run(()=>preferences(id,{hidden:true})),
    togglePin:(id:string)=>run(()=>preferences(id,{pinned:!cache.current.find(c=>c.id===id)?.pinned})),
    setUnread:(id:string,unread:boolean)=>run(()=>preferences(id,{unread_override:unread})),
    markRead:useCallback((id:string)=>run(async()=>{const sequence=cache.current.find(c=>c.id===id)?.lastSequence;if(sequence===undefined)return;await api.markRead(id,sequence);await loadInbox();}),[run,loadInbox]),
    rateConversation:async(id:string,stars:number)=>{await ratings.submitRating(id,stars);await loadThread(id);},
    dismissRating:async(id:string)=>{await ratings.dismissRating(id);await loadThread(id);},
  };
}
