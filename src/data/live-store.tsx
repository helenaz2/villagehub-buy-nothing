import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './auth';
import { StoreContext, type Store } from './store-context';
import { useLiveMessaging } from './use-live-messaging';
import { fetchAddress, fetchProfile } from '@/services/profiles';
import { savePendingStreet } from '@/services/pending-address';
import * as listings from '@/services/listings';
import * as ai from '@/services/ai';
import { backendConfig } from '@/lib/backend-config';
import { CATEGORIES, type Item, type Person } from '@/types/listing';

const emptyPerson: Person = { id: '', name: '', handle: '', avatar: '', neighborhood: '', city: '', bio: '', rating: 0, memberSince: '', monthsHere: 0 };
function pending(): never { throw new Error('This feature is not connected to Supabase yet.'); }
const merge = (old: Item[], next: Item[]) => [...next, ...old.filter(i => !next.some(n => n.id === i.id))];
export function LiveStoreProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const id = auth.session?.user.id;
  const [profile, setProfile] = useState<Person | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [street, setStreet] = useState('');
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const { people: messagePeople, ...messaging } = useLiveMessaging(id,setOperationError);
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([...CATEGORIES]);
  const [feedIds, setFeedIds] = useState<string[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [moreOwn, setMoreOwn] = useState(false);
  const [moreSaved, setMoreSaved] = useState(false);
  const state = useRef({ owner: '', request: 0, offset: 0, query: '', category: 'For you', ownOffset: 0, savedOffset: 0, ownBusy: false, savedBusy: false });
  const proposalKeys=useRef(new Map<string,string>());
  const reloadCategories=useCallback(async()=>{
    if(!id || !backendConfig.listings)return;
    const catalog=await listings.getCategories();if(state.current.owner===id)setCategories(catalog.map(c=>c.name));
  },[id]);
  useEffect(()=>{
    if(!id || !backendConfig.ai)return;
    return ai.subscribeCategories(id,()=>{void reloadCategories().catch(()=>setOperationError('Unable to refresh categories. Please retry.'));});
  },[id,reloadCategories]);
  useEffect(() => {
    let active = true;
    state.current = { owner: id ?? '', request: state.current.request+1, offset:0,query:'',category:'For you',ownOffset:0,savedOffset:0,ownBusy:false,savedBusy:false };
    if (!id) return;
    void savePendingStreet({ id, email: auth.session?.user.email }).then(() => Promise.all([
      fetchProfile(id), fetchAddress(id),
      backendConfig.listings ? listings.getCategories() : Promise.resolve([]),
      backendConfig.listings ? listings.getSavedIds() : Promise.resolve([]),
    ])).then(([next,address,catalog,saved]) => {
      if (!active) return;
      setProfile(next); setStreet(address); setError(null); setLoadedId(id);
      setSavedIds(saved); if (catalog.length) setCategories(catalog.map(c => c.name));
      setPeople(next ? [next] : []); setItems([]); setFeedIds([]);
    }).catch(e => { if (active) { setProfile(null); setStreet(''); setError(e instanceof Error ? e.message : 'Unable to load account.'); setLoadedId(id); } });
    return () => { active=false; state.current.request++; };
  }, [id,auth.session?.user.email,attempt]);
  const addItems = useCallback(async (next: Item[]) => {
    if (!id || state.current.owner !== id) return;
    setItems(old => merge(old,next));
    const hosts = await Promise.all([...new Set(next.map(i => i.hostId))].map(fetchProfile));
    if (state.current.owner !== id) return;
    setPeople(old => { const fresh=hosts.filter((p): p is Person => !!p); return [...fresh,...old.filter(p => !fresh.some(n => n.id === p.id))]; });
  }, [id]);
  const refreshListing = useCallback(async (listingId: string) => {
    if (!backendConfig.listings || !id) return;
    try { const item=await listings.getListing(listingId); if (item) await addItems([item]); else setItems(old => old.filter(i => i.id !== listingId)); }
    catch(e) { setOperationError(e instanceof Error ? e.message : 'Unable to refresh listing.'); }
  }, [id,addItems]);
  const fetchFeed = useCallback(async (query: string,category: string,more=false) => {
    if (!backendConfig.listings || !id) return;
    const seq=++state.current.request;
    const offset=more && query===state.current.query && category===state.current.category ? state.current.offset : 0;
    setFeedLoading(true); setOperationError(null);
    try {
      const next=await listings.listListings({query,category,offset});
      if (seq!==state.current.request || state.current.owner!==id) return;
      await addItems(next);
      if (seq!==state.current.request) return;
      setFeedIds(old => offset ? [...new Set([...old,...next.map(i => i.id)])] : next.map(i => i.id));
      state.current.offset=offset+next.length; state.current.query=query; state.current.category=category;
      setHasMore(next.length===listings.PAGE_SIZE);
    } catch(e) { if(seq===state.current.request) setOperationError(e instanceof Error ? e.message : 'Unable to load items.'); }
    finally { if(seq===state.current.request) setFeedLoading(false); }
  }, [id,addItems]);
  const loadOwnListings = useCallback(async (more=false) => {
    if (!backendConfig.listings || !id || state.current.ownBusy) return;
    state.current.ownBusy=true;
    try { const offset=more ? state.current.ownOffset : 0; const next=await listings.listListings({ownerId:id,offset}); if(state.current.owner!==id) return; await addItems(next); state.current.ownOffset=offset+next.length; setMoreOwn(next.length===listings.PAGE_SIZE); }
    catch(e) { setOperationError(e instanceof Error ? e.message : 'Unable to load your posts.'); }
    finally { state.current.ownBusy=false; }
  }, [id,addItems]);
  const loadSavedListings = useCallback(async (more=false) => {
    if (!backendConfig.listings || !id || state.current.savedBusy) return;
    state.current.savedBusy=true;
    try { const offset=more ? state.current.savedOffset : 0; const [next,saved]=await Promise.all([listings.listListings({savedOnly:true,offset}),listings.getSavedIds()]); if(state.current.owner!==id) return; await addItems(next); setSavedIds(saved); state.current.savedOffset=offset+next.length; setMoreSaved(next.length===listings.PAGE_SIZE); }
    catch(e) { setOperationError(e instanceof Error ? e.message : 'Unable to load saved posts.'); }
    finally { state.current.savedBusy=false; }
  }, [id,addItems]);
  const current=id && loadedId===id ? profile : null;
  function run(action: () => Promise<void>) { void action().catch(e => setOperationError(e instanceof Error ? e.message : 'Unable to save changes.')); }
  const value: Store = {
    loading:!auth.ready || (!!id && loadedId!==id), storeError:auth.error ?? (id ? error : null),
    retry:() => { setAttempt(n => n+1); if(auth.error) auth.reload(); }, signedIn:!!auth.session,
    accountAddress:current ? {street,state:current.state ?? ''} : null,
    startDemoSession:pending,
    signOut:() => { void auth.signOut().catch(e => setError(e instanceof Error ? e.message : 'Unable to log out.')); },
    categories,reloadCategories,items:current ? items : [],people:current ? [...people,...messagePeople] : [],me:current ?? {...emptyPerson,id:id ?? ''},savedIds:current ? savedIds : [],draft:null,
    ...messaging,
    person:personId => personId===current?.id ? current : messagePeople.find(p=>p.id===personId) ?? people.find(p => p.id===personId),ratingFor:personId => (personId===current?.id ? current : messagePeople.find(p=>p.id===personId) ?? people.find(p=>p.id===personId))?.rating??0,
    feedItems:feedIds.map(key => items.find(i => i.id===key)).filter((i): i is Item => !!i && i.status === 'available'),feedLoading,hasMoreListings:hasMore,fetchFeed,refreshListing,loadOwnListings,loadSavedListings,moreOwn,moreSaved,
    operationError,dismissOperationError:() => setOperationError(null),
    publish:async item => { if(!id || !backendConfig.listings) return pending(); const key=await listings.saveListing(item,id); await refreshListing(key); return key; },
    updateItem:async (key,patch) => { if(!id || !backendConfig.listings) return pending(); const existing=items.find(i => i.id===key); if(!existing) throw new Error('Refresh this post before editing.'); await listings.saveListing({...existing,...patch},id,existing); await refreshListing(key); },
    toggleSave:key => { if(!id || !backendConfig.listings) return; run(async () => { const save=!savedIds.includes(key); await listings.setSaved(id,key,save); const next=await listings.getSavedIds(); setSavedIds(next); }); },
    claim:key => run(async () => { await listings.setListingStatus(key,'claimed'); await refreshListing(key); }),
    relist:key => run(async () => { await listings.setListingStatus(key,'available'); await refreshListing(key); }),
    removeItem:key => run(async () => { const item=items.find(i => i.id===key); if(!item) return; try { await listings.deleteListing(item); } finally { await refreshListing(key); } setSavedIds(old => old.filter(i => i!==key)); }),
    proposeCategory:async(name,reason)=>{
      if(!id || !backendConfig.ai)return pending();
      const input=id+'\n'+name.trim().toLowerCase()+'\n'+reason.trim();
      const key=proposalKeys.current.get(input)??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);proposalKeys.current.set(input,key);
      const proposal=await ai.createProposal(name,reason,key);
      try {const result=await ai.reviewProposal(proposal.id);await reloadCategories();return result;}
      catch(e){return {status:'pending',name:proposal.name,message:(e instanceof Error?e.message:'AI review unavailable.')+' Your proposal is saved; retry it below.',source:'server'};}
    },
    saveDraft:pending,clearDraft:pending,updateMe:pending,
  };
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
