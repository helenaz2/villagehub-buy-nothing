// Requires approval for migration/deployment, test fixtures and paid AI calls.
// Normal success makes THREE paid calls. Successful retries are cached. Do not
// rerun after a failure without checking the remaining approved call allowance.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {testBackend,checked,fixtureAccount}=require('./supabase-test-admin.cjs');
const backend=testBackend(),accounts=[],proposals=[],requestKeys=[];let retainedCategory;
async function invoke(client,name,body){const session=checked(await client.auth.getSession(),'session').session;const response=await fetch(backend.url+'/functions/v1/'+name,{method:'POST',headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});let data;try{data=await response.json();}catch{data={message:'Non-JSON function response'};}return {status:response.status,data};}
function readyCategory(client){let readyResolve,eventResolve;const ready=new Promise(resolve=>{readyResolve=resolve;}),event=new Promise(resolve=>{eventResolve=resolve;});const channel=client.channel('phase5-'+randomUUID()).on('postgres_changes',{event:'INSERT',schema:'public',table:'categories'},payload=>eventResolve(payload.new)).on('system',{},payload=>{if(payload.extension==='postgres_changes'&&payload.status==='ok')readyResolve();}).subscribe();return {channel,ready,event};}
function timeout(promise,ms){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Realtime readiness/delivery timeout')),ms);})]).finally(()=>clearTimeout(timer));}
const clients=[];
async function main(){
 const a=await fixtureAccount(backend,'phase5','Proposer'),b=await fixtureAccount(backend,'phase5','Neighbor'),c=await fixtureAccount(backend,'phase5','Quota');accounts.push(a.id,b.id,c.id);clients.push(a.client,b.client,c.client);
 const before=checked(await a.client.from('categories').select('id,name,sort_order').order('sort_order').order('name'),'catalog');
 const name=['Books','Board Games','Garden Supplies','Musical Instruments'].find(name=>!before.some(row=>row.name.toLowerCase()===name.toLowerCase()));if(!name)throw Error('Choose a fresh broad test category before running AI.');
 assert.ok((await a.client.from('categories').insert({name:'Forged category'})).error,'clients cannot add global categories directly');
 const key=randomUUID();const p=checked(await a.client.rpc('create_category_proposal',{p_name:name,p_reason:'A broad category for neighbors to give away these useful physical items for free.',p_client_key:key}),'own proposal');proposals.push({id:p.id,user:a.id});
 assert.equal(checked(await a.client.rpc('create_category_proposal',{p_name:name,p_reason:'A broad category for neighbors to give away these useful physical items for free.',p_client_key:key}),'idempotent proposal').id,p.id);
 assert.equal(checked(await b.client.from('category_proposals').select('*').eq('id',p.id),'proposal isolation').length,0);
 assert.ok((await b.client.from('category_proposals').update({status:'approved'}).eq('id',p.id)).error,'clients cannot approve proposals');
 assert.ok((await b.client.rpc('reserve_ai_request',{p_user_id:a.id,p_kind:'photo',p_request_key:'forged',p_payload_hash:'a'.repeat(64)})).error,'client cannot reserve privileged AI work');
 const unauthorized=await invoke(b.client,'category-review',{proposalId:p.id});assert.equal(unauthorized.status,404);
 const anonymous=await fetch(backend.url+'/functions/v1/category-review',{method:'POST',headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({proposalId:p.id})});assert.equal(anonymous.status,401);
 const subscriber=readyCategory(b.client);await timeout(subscriber.ready,20000);
 const approval=await invoke(a.client,'category-review',{proposalId:p.id});assert.equal(approval.status,200,approval.data.message);assert.equal(approval.data.status,'approved');
 const inserted=await timeout(subscriber.event,20000);assert.equal(inserted.name,approval.data.name);retainedCategory={id:inserted.id,name:inserted.name};await b.client.removeChannel(subscriber.channel);
 const shared=checked(await b.client.from('categories').select('id,name,sort_order').order('sort_order').order('name'),'shared catalog');assert.equal(shared.at(-1).name,'Other');assert.ok(shared.findIndex(row=>row.id===inserted.id)<shared.length-1);
 const duplicate=checked(await b.client.rpc('create_category_proposal',{p_name:name.toLowerCase(),p_reason:'These are useful items for sharing with neighbors.',p_client_key:randomUUID()}),'case-insensitive duplicate');proposals.push({id:duplicate.id,user:b.id});assert.equal(duplicate.status,'approved');assert.equal(duplicate.category_id,inserted.id);
 const rejected=checked(await a.client.rpc('create_category_proposal',{p_name:'Illegal Weapons',p_reason:'A category for giving away illegal weapons and prohibited goods.',p_client_key:randomUUID()}),'rejection fixture');proposals.push({id:rejected.id,user:a.id});const rejection=await invoke(a.client,'category-review',{proposalId:rejected.id});assert.equal(rejection.status,200,rejection.data.message);assert.equal(rejection.data.status,'rejected');
 const photo='data:image/png;base64,'+fs.readFileSync('scripts/fixtures/mug.png').toString('base64');const photoKey=randomUUID();requestKeys.push(photoKey);
 const suggestion=await invoke(a.client,'photo-autofill',{image:photo,requestKey:photoKey});assert.equal(suggestion.status,200,suggestion.data.message);assert.match(suggestion.data.title,/mug|cup/i);assert.ok(shared.some(row=>row.name===suggestion.data.category));assert.ok(suggestion.data.tags.length<=8);
 const cached=await invoke(a.client,'photo-autofill',{image:photo,requestKey:photoKey});assert.equal(cached.status,200);assert.deepEqual(cached.data,suggestion.data);
 const ledger=checked(await backend.admin.from('ai_requests').select('attempts,status').eq('user_id',a.id).eq('kind','photo').eq('request_key',photoKey).single(),'cached request ledger');assert.equal(ledger.attempts,1);assert.equal(ledger.status,'succeeded');
 const privateRequests=await b.client.from('ai_requests').select('*').eq('user_id',a.id);assert.ok(privateRequests.error?.code==='42501'||(!privateRequests.error&&privateRequests.data.length===0));
 const invalid=await invoke(a.client,'photo-autofill',{image:'https://example.com/untrusted.jpg',requestKey:randomUUID()});assert.equal(invalid.status,400);
 // Exercise quota serialization with SQL reservations only, never OpenAI calls.
 const concurrent=await Promise.all(Array.from({length:11},()=>backend.admin.rpc('reserve_ai_request',{p_user_id:c.id,p_kind:'photo',p_request_key:randomUUID(),p_payload_hash:'a'.repeat(64)})));
 const leases=concurrent.map(result=>checked(result,'concurrent quota reservation'));assert.equal(leases.filter(row=>row.status==='reserved').length,10);assert.equal(leases.filter(row=>row.status==='limited').length,1);
 for(const owner of accounts)checked(await backend.admin.from('ai_requests').delete().eq('user_id',owner),'own request fixture cleanup');
 for(const proposal of proposals)checked(await backend.admin.from('category_proposals').delete().eq('id',proposal.id).eq('user_id',proposal.user),'exact proposal fixture cleanup');
 console.log(JSON.stringify({status:'PASS',retainedAccountIds:accounts,retainedUsefulSharedCategory:retainedCategory,removedOwnProposalFixtures:proposals,removedOwnAIRequestFixtures:true,usageCountersRetained:true,verified:['real AI approval/rejection','global category realtime delivery','Other last','case-insensitive deduplication','private proposals','authenticated ownership','real mug image recognition','cached retry without repeated call','server-only credentials','concurrent daily quota','input validation']}));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',message:e.message,retainedAccountIds:accounts,createdProposalFixtures:proposals,photoRequestKeys:requestKeys,retainedCategory}));process.exitCode=1;}).finally(async()=>{await Promise.all(clients.map(client=>client.removeAllChannels()));});
