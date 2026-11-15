// Run only after approval for Phase 3 and this run's fixture cleanup.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {testBackend,checked,fixtureAccount}=require('./supabase-test-admin.cjs');
const backend=testBackend(),accounts=[],fixtures={},clients=[];
function service(client){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/services/messaging.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports:m.exports,Date,require:id=>id==='@/lib/backend-config'?{backendConfig:{ratings:false}}:{getSupabase:()=>client}});return m.exports;}
function subscription(client,table,id){
 let resolve,readyResolve,readyReject;const event=new Promise(r=>resolve=r);
 const ready=new Promise((res,rej)=>{readyResolve=res;readyReject=rej;});
 const timer=setTimeout(()=>readyReject(new Error('Realtime backend readiness timeout')),20000);
 const channel=client.channel('phase3-'+randomUUID()).on('postgres_changes',{event:'INSERT',schema:'public',table,filter:'conversation_id=eq.'+id},payload=>resolve(payload)).on('system',{},payload=>{
   if(payload.extension==='postgres_changes' && payload.status==='ok'){clearTimeout(timer);readyResolve();}
 }).subscribe(status=>{if(status==='CHANNEL_ERROR' || status==='TIMED_OUT'){clearTimeout(timer);readyReject(new Error('Realtime subscription error'));}});
 return {channel,ready,event};
}
const timeout=(promise,ms)=>{let timer;return Promise.race([promise,new Promise((_,rej)=>{timer=setTimeout(()=>rej(new Error('Realtime delivery timeout')),ms);})]).finally(()=>clearTimeout(timer));};
async function main(){
 const a=await fixtureAccount(backend,'phase3','Host'),b=await fixtureAccount(backend,'phase3','Requester'),outsider=await fixtureAccount(backend,'phase3','Outsider');accounts.push(a.id,b.id,outsider.id);
 clients.push(a.client,b.client,outsider.client);
 const api=service(a.client),other=service(b.client),outside=service(outsider.client);
 const cat=checked(await a.client.from('categories').select('id').limit(1),'category')[0];
 const listing=checked(await a.client.from('listings').insert({owner_id:a.id,category_id:cat.id,title:'Phase3 fixture '+randomUUID(),condition:'Fair',size:'Small',color:'White',neighborhood:'Brooklyn',city:'Brooklyn'}).select('id').single(),'listing');fixtures.listing=listing.id;
 // Publish a genuine tiny private photo through the same owner-authorized RPC.
 const path=a.id+'/'+listing.id+'/phase3.png';fixtures.path=path;
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGQAAAAASUVORK5CYII=','base64');
 checked(await a.client.storage.from('listing-photos').upload(path,png,{contentType:'image/png'}),'upload');
 checked(await a.client.rpc('publish_listing_photos',{p_listing_id:listing.id,p_paths:[path]}),'publish');
 assert.ok((await a.client.rpc('open_conversation',{p_listing_id:listing.id})).error,'cannot message self');
 const id=await other.openThread(listing.id);fixtures.conversation=id;
 assert.equal(await other.openThread(listing.id),id,'open idempotence');
 assert.equal((await api.getInbox(a.id))[0].participantId,b.id);
 assert.equal(await outside.getThread(id,outsider.id),null);
 assert.equal((await outside.getMessages(id,outsider.id)).length,0);
 assert.ok((await outsider.client.rpc('send_message',{p_conversation_id:id,p_body:'intrusion',p_client_key:'x'})).error);
 assert.ok((await outsider.client.rpc('mark_conversation_read',{p_conversation_id:id,p_sequence:0})).error);
 const denied=checked(await outsider.client.from('conversation_members').update({pinned:true}).eq('conversation_id',id).eq('user_id',a.id).select('user_id'),'outsider prefs');assert.equal(denied.length,0);
 assert.ok((await b.client.from('messages').insert({conversation_id:id,sender_id:a.id,sequence:1,body:'forged',client_key:'forged'})).error,'no direct forged message');
 assert.ok((await b.client.from('conversation_members').update({last_read_sequence:100}).eq('conversation_id',id)).error,'read sequence server only');
 assert.ok((await b.client.from('conversations').update({preview:'forged'}).eq('id',id)).error,'preview server only');
 let inboxReady,inboxChanged;
 const inboxReadyEvent=new Promise(resolve=>{inboxReady=resolve;}),inboxChangeEvent=new Promise(resolve=>{inboxChanged=resolve;});
 const stopInbox=api.subscribeInbox(a.id,()=>inboxChanged(),status=>{if(status==='SUBSCRIBED') inboxReady();});
 const own=subscription(a.client,'messages',id),foreign=subscription(outsider.client,'messages',id);await Promise.all([own.ready,foreign.ready,timeout(inboxReadyEvent,20000)]);let leaked=false;foreign.event.then(()=>{leaked=true;});
 const key=randomUUID();await other.sendMessage(id,'Hello neighbor',key);await other.sendMessage(id,'Hello neighbor',key);
 const event=await timeout(own.event,15000);assert.equal(event.new.body,'Hello neighbor');
 await timeout(inboxChangeEvent,15000);
 assert.equal((await api.getMessages(id,a.id)).length,1,'retry does not duplicate');
 assert.ok((await b.client.rpc('send_message',{p_conversation_id:id,p_body:'different',p_client_key:key})).error,'retry key cannot change body');
 let row=await api.getThread(id,a.id);assert.equal(row.unread,true);assert.equal(row.preview,'Hello neighbor');
 await api.markRead(id,row.lastSequence);assert.equal((await api.getThread(id,a.id)).unread,false);
 await api.setPreferences(id,a.id,{pinned:true,unread_override:true});assert.equal((await api.getThread(id,a.id)).pinned,true);assert.equal((await other.getThread(id,b.id)).pinned,false);
 await api.setPreferences(id,a.id,{hidden:true});assert.equal((await api.getInbox(a.id)).some(c=>c.id===id),false);assert.equal((await other.getInbox(b.id)).some(c=>c.id===id),true);
 await other.sendMessage(id,'New message restores inbox',randomUUID());assert.equal((await api.getThread(id,a.id)).hidden,false);
 await api.markRead(id,1);assert.equal((await api.getThread(id,a.id)).unread,true,'old read cannot swallow newer message');
 await api.sendMessage(id,'Thanks',randomUUID());assert.equal((await other.getThread(id,b.id)).unread,true);
 assert.ok((await b.client.rpc('send_message',{p_conversation_id:id,p_body:' ',p_client_key:randomUUID()})).error);
 assert.ok((await b.client.rpc('send_message',{p_conversation_id:id,p_body:'x'.repeat(4001),p_client_key:randomUUID()})).error);
 for(let i=0;i<31;i++) await other.sendMessage(id,'Page '+i,randomUUID());
 const latest=await api.getMessages(id,a.id);assert.equal(latest.length,30);const earlier=await api.getMessages(id,a.id,latest[0].sequence);assert.ok(earlier.length>0);assert.ok(earlier.at(-1).sequence<latest[0].sequence);
 assert.equal(leaked,false,'outsider receives no realtime messages');
 stopInbox();
 await Promise.all([a.client.removeChannel(own.channel),outsider.client.removeChannel(foreign.channel)]);
 // Exact fixture identifiers only; retain Auth accounts. Conversations are hidden
 // by users in the app; admin cleanup here applies only to this test fixture.
 checked(await a.client.from('listings').delete().eq('id',listing.id).eq('owner_id',a.id),'fixture listing cleanup');
 const retainedThread=await api.getThread(id,a.id);assert.equal(retainedThread.itemId,'');assert.ok(retainedThread.title.startsWith('Phase3 fixture '),'conversation survives listing deletion');
 checked(await backend.admin.from('conversations').delete().eq('id',id).eq('host_id',a.id).eq('requester_id',b.id),'fixture conversation cleanup');
 checked(await a.client.storage.from('listing-photos').remove([path]),'fixture photo cleanup');
 console.log(JSON.stringify({status:'PASS',retainedAccountIds:accounts,removedOwnFixtures:fixtures,verified:['two-way messages','retry deduplication','participant RLS','outsider realtime denial','real realtime delivery','private preferences','read sequence race protection','hidden-thread restore','pagination','server validation']}));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',message:e.message,retainedAccountIds:accounts,createdFixtures:fixtures}));process.exitCode=1;}).finally(async()=>{await Promise.all(clients.map(client=>client.removeAllChannels()));});
