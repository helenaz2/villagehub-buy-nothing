// Approval required: Phase 4, deployed/configured worker, and exact fixture cleanup.
// This intentionally waits through the REAL five-minute idle delay and Cron tick.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {testBackend,checked,fixtureAccount}=require('./supabase-test-admin.cjs');
const backend=testBackend(),accounts=[],fixtures=[];
function service(path,client){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports:m.exports,Date,require:id=>id==='@/lib/backend-config'?{backendConfig:{ratings:false}}:{getSupabase:()=>client}});return m.exports;}
async function main(){
 const a=await fixtureAccount(backend,'phase4','Host'),b=await fixtureAccount(backend,'phase4','Requester'),outsider=await fixtureAccount(backend,'phase4','Outsider');accounts.push(a.id,b.id,outsider.id);
 const msgA=service('src/services/messaging.ts',a.client),msgB=service('src/services/messaging.ts',b.client);
 const api=service('src/services/ratings.ts',a.client),other=service('src/services/ratings.ts',b.client);
 const cat=checked(await a.client.from('categories').select('id').limit(1),'category')[0];
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGQAAAAASUVORK5CYII=','base64');
 for(let n=0;n<2;n++) {
   const listing=checked(await a.client.from('listings').insert({owner_id:a.id,category_id:cat.id,title:'Phase4 fixture '+randomUUID(),condition:'Fair',size:'Small',color:'White',neighborhood:'Brooklyn',city:'Brooklyn'}).select('id').single(),'fixture listing');
   const f={listing:listing.id,owner:a.id,requester:b.id,path:a.id+'/'+listing.id+'/phase4.png'};fixtures.push(f);
   checked(await a.client.storage.from('listing-photos').upload(f.path,png,{contentType:'image/png'}),'fixture upload');
   checked(await a.client.rpc('publish_listing_photos',{p_listing_id:listing.id,p_paths:[f.path]}),'fixture publish');
   f.conversation=await msgB.openThread(listing.id);
   await msgB.sendMessage(f.conversation,'Hello',randomUUID());
   assert.ok((await b.client.rpc('submit_conversation_rating',{p_conversation_id:f.conversation,p_stars:5})).error,'one-way conversation is ineligible');
   await msgA.sendMessage(f.conversation,'Thanks for asking',randomUUID());
   const initial=checked(await backend.admin.from('rating_jobs').select('due_at,sequence').eq('conversation_id',f.conversation).single(),'durable job');
   await msgB.sendMessage(f.conversation,'Resuming before idle delay',randomUUID());
   const rescheduled=checked(await backend.admin.from('rating_jobs').select('due_at,sequence').eq('conversation_id',f.conversation).single(),'rescheduled job');
   assert.equal(rescheduled.sequence,initial.sequence+1);assert.ok(Date.parse(rescheduled.due_at)>Date.parse(initial.due_at));f.due=rescheduled.due_at;
   assert.ok((await a.client.rpc('submit_conversation_rating',{p_conversation_id:f.conversation,p_stars:5})).error,'early rating rejected');
 }
 assert.ok((await a.client.rpc('process_rating_jobs')).error,'ordinary users cannot run worker RPC');
 const privateJobs=await a.client.from('rating_jobs').select('*');
 assert.ok(privateJobs.error?.code==='42501' || (!privateJobs.error && privateJobs.data.length===0),'ordinary users cannot read private jobs');
 assert.ok((await a.client.from('ratings').insert({conversation_id:fixtures[0].conversation,rater_id:b.id,ratee_id:a.id,stars:5})).error,'direct forged rating denied');
 checked(await backend.admin.rpc('process_rating_jobs'),'early worker retry');
 assert.equal(checked(await a.client.from('rating_invitations').select('*').in('conversation_id',fixtures.map(f=>f.conversation)),'no early invitations').filter(i=>i.available_at).length,0);
 const publicOnly=await fetch(backend.url+'/functions/v1/rating-invitations',{method:'POST',headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY},body:'{}'});assert.equal(publicOnly.status,401,'publishable key cannot invoke worker');
 const started=Date.now();let delivered;
 while(Date.now()-started<8*60*1000) {
   delivered=checked(await a.client.from('rating_invitations').select('conversation_id,available_at').in('conversation_id',fixtures.map(f=>f.conversation)),'poll actual Cron invitations');
   if(delivered.length===2 && delivered.every(i=>i.available_at)) break;
   console.log(JSON.stringify({status:'WAITING_FOR_REAL_CRON',elapsedSeconds:Math.round((Date.now()-started)/1000)}));
   await new Promise(resolve=>setTimeout(resolve,20000));
 }
 assert.equal(delivered.length,2,'Cron/Edge worker must deliver both invitations');
 for(const f of fixtures) assert.ok(Date.parse(delivered.find(i=>i.conversation_id===f.conversation).available_at)>=Date.parse(f.due),'never delivered before five-minute due time');
 assert.equal(checked(await outsider.client.from('rating_invitations').select('*').in('conversation_id',fixtures.map(f=>f.conversation)),'outsider invitation isolation').length,0);
 const id=fixtures[0].conversation;
 assert.ok((await outsider.client.rpc('submit_conversation_rating',{p_conversation_id:id,p_stars:5})).error,'outsider cannot rate');
 assert.ok((await a.client.rpc('submit_conversation_rating',{p_conversation_id:id,p_stars:6})).error,'invalid stars rejected');
 await api.dismissRating(id);const dismissed=checked(await a.client.from('rating_invitations').select('dismissed_at').eq('conversation_id',id).single(),'persisted dismissal');assert.ok(dismissed.dismissed_at);
 const otherDismissed=checked(await b.client.from('rating_invitations').select('dismissed_at').eq('conversation_id',id).single(),'independent dismissal');assert.equal(otherDismissed.dismissed_at,null);
 await api.submitRating(id,3);await api.submitRating(id,3);assert.ok((await a.client.rpc('submit_conversation_rating',{p_conversation_id:id,p_stars:4})).error,'immutable once submitted');
 await other.submitRating(id,5);
 assert.equal((await api.getRatingStats([a.id]))[0].average_rating,5);assert.equal((await other.getRatingStats([b.id]))[0].average_rating,3);
 const restored=service('src/services/ratings.ts',a.client);assert.equal((await restored.attachRatingState([{id,lastSequence:3,messages:[]}],a.id))[0].ratings[a.id],3,'rating survives service recreation');
 assert.equal(checked(await outsider.client.from('ratings').select('*').eq('conversation_id',id),'private raw ratings').length,0);
 const resumed=fixtures[1].conversation;await msgB.sendMessage(resumed,'Conversation resumes after invitation',randomUUID());
 assert.equal(checked(await a.client.from('rating_invitations').select('available_at').eq('conversation_id',resumed).single(),'revoked invitation').available_at,null);
 assert.ok((await a.client.rpc('submit_conversation_rating',{p_conversation_id:resumed,p_stars:5})).error,'stale invitation cannot bypass resumed wait');
 for(const f of fixtures) {
   checked(await backend.admin.from('conversations').delete().eq('id',f.conversation).eq('host_id',f.owner).eq('requester_id',f.requester),'exact conversation/rating fixture cleanup');
   checked(await a.client.from('listings').delete().eq('id',f.listing).eq('owner_id',f.owner),'exact listing cleanup');
   checked(await a.client.storage.from('listing-photos').remove([f.path]),'exact photo cleanup');
 }
 console.log(JSON.stringify({status:'PASS',retainedAccountIds:accounts,removedOwnFixtures:fixtures,verified:['real five-minute delay','Cron to Edge delivery','durable rescheduling','resumed conversation revocation','two-way ratings','immutable/idempotent submissions','aggregate ratings','participant RLS','private dismissals','server-only worker authorization']}));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',message:e.message,retainedAccountIds:accounts,createdFixtures:fixtures}));process.exitCode=1;});
