// Requires approval for Phase A, dedicated identity bootstrap, Edge deployment
// and scoped fixtures. Uses FAKE marketplace URLs; it NEVER fetches their pages.
const assert=require('node:assert/strict'),{randomBytes}=require('node:crypto');
const {testBackend,checked,fixtureAccount}=require('./supabase-test-admin.cjs');
const backend=testBackend(),accounts=[],receipts=[],candidates=[];let reviewer,nativeDraft,systemFixture;
async function invoke(client,body){const session=checked(await client.auth.getSession(),'session').session;const response=await fetch(backend.url+'/functions/v1/external-submit',{method:'POST',headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
async function main(){
 const a=await fixtureAccount(backend,'externalA','Submitter'),b=await fixtureAccount(backend,'externalA','Reviewer');accounts.push(a.id,b.id);
 const identity=checked(await backend.admin.from('external_system_identity').select('user_id').eq('slot','villagehub-buy-nothing').single(),'official identity');assert.ok(identity.user_id);
 const official=checked(await backend.admin.from('profiles').select('username,full_name').eq('id',identity.user_id).single(),'official profile');assert.equal(official.username,'villagehub-buy-nothing');
 const officialAuth=checked(await backend.admin.auth.admin.getUserById(identity.user_id),'official Auth');assert.ok(Date.parse(officialAuth.user.banned_until)>Date.now());
 for(const patch of [{username:'villagehub-buy-nothing'},{username:'villagehub_buy_nothing'},{full_name:'VillageHub Official'}])assert.ok((await a.client.from('profiles').update(patch).eq('id',a.id)).error,'reserved impersonation denied');
 assert.ok((await a.client.rpc('register_external_system_identity',{p_user_id:a.id})).error,'ordinary identity registration denied');
 assert.ok((await a.client.from('external_reviewers').insert({user_id:a.id,role:'administrator'})).error,'self-elevation denied');
 const category=checked(await a.client.from('categories').select('id').eq('name','Other').single(),'native category');
 nativeDraft=checked(await a.client.from('listings').insert({owner_id:a.id,category_id:category.id,title:'External foundation native regression fixture',condition:'Fair',size:'Small',color:'White',neighborhood:'Downtown',city:'Berkeley'}).select('id').single(),'native private draft remains working').id;
 checked(await a.client.from('listings').update({title:'External foundation native edit fixture'}).eq('id',nativeDraft),'native edit remains working');
 const configs=checked(await backend.admin.from('external_sources').select('id,slug,collection_authorized,republication_authorized,automatic_publication'),'source settings');assert.ok(configs.every(source=>!source.collection_authorized&&!source.republication_authorized&&!source.automatic_publication));
 const externalId=BigInt('0x'+randomBytes(7).toString('hex')).toString();
 const evidence={url:'https://www.facebook.com/marketplace/item/'+externalId,title:'Free test desk',notes:'These are my original test notes about a free desk at no charge.',price:0,kind:'offer',availability:'unverified',city:'Berkeley',neighborhood:'',notesOwned:true};
 const first=await invoke(a.client,evidence);assert.equal(first.status,200,first.data.message);receipts.push(first.data.id);assert.equal(first.data.classification,'reported_free');
 const own=checked(await a.client.from('external_link_submissions').select('id,candidate_id').eq('id',first.data.id).single(),'own receipt');candidates.push(own.candidate_id);
 const duplicate=await invoke(a.client,evidence);assert.equal(duplicate.data.id,first.data.id,'idempotent own receipt');
 assert.equal(checked(await b.client.from('external_link_submissions').select('id').eq('id',first.data.id),'receipt privacy').length,0);
 assert.equal(checked(await a.client.from('external_listing_candidates').select('id').eq('id',own.candidate_id),'private review queue').length,0);
 const second=await invoke(b.client,{...evidence,url:'https://m.facebook.com/marketplace/item/'+externalId+'/?ref=share',notes:'A separate original note from this test submitter.'});assert.equal(second.status,200);receipts.push(second.data.id);
 const otherReceipt=checked(await b.client.from('external_link_submissions').select('candidate_id').eq('id',second.data.id).single(),'own second receipt');assert.equal(otherReceipt.candidate_id,own.candidate_id,'global deduplication');
 const candidate=checked(await backend.admin.from('external_listing_candidates').select('*').eq('id',own.candidate_id).single(),'private candidate');assert.equal(candidate.availability,'unverified');assert.equal(candidate.rights_status,'unverified');assert.equal(candidate.publication_status,'not_published');
 const hidden=checked(await backend.admin.from('listings').insert({owner_id:identity.user_id,category_id:category.id,title:'External system hidden fixture',condition:'Fair',size:'Small',color:'White',neighborhood:'Downtown',city:'Berkeley'}).select('id').single(),'hidden system fixture');
 systemFixture={id:hidden.id,path:identity.user_id+'/'+hidden.id+'/foundation-test.png'};
 checked(await backend.admin.storage.from('listing-photos').upload(systemFixture.path,require('node:fs').readFileSync('scripts/fixtures/mug.png'),{contentType:'image/png'}),'owned system fixture image');
 checked(await backend.admin.from('listing_photos').insert({listing_id:hidden.id,object_path:systemFixture.path,position:0}),'system fixture photo metadata');
 checked(await backend.admin.from('listings').update({status:'available'}).eq('id',hidden.id),'exercise system visibility gate');
 assert.equal(checked(await a.client.from('listings').select('id').eq('id',hidden.id),'unapproved system listing hidden').length,0);
 assert.equal(checked(await a.client.rpc('search_listing_recommendations',{p_items:['external system hidden fixture']}),'chatbot cannot expose unapproved system post').some(row=>row.id===hidden.id),false);
 assert.ok((await a.client.rpc('open_conversation',{p_listing_id:hidden.id})).error,'system is not a message host');
 assert.ok((await backend.admin.from('external_listing_links').insert({candidate_id:own.candidate_id,listing_id:hidden.id,source_name:'Facebook Marketplace',source_url:candidate.canonical_url,publication_status:'published'})).error,'even backend publication requires evidence and verification');
 assert.ok((await backend.admin.from('external_listing_links').insert({candidate_id:own.candidate_id,listing_id:hidden.id,source_name:'Facebook Marketplace',source_url:candidate.canonical_url,publication_status:'published',availability:'verified_available',last_verified_at:candidate.first_discovered_at,fresh_until:new Date(Date.parse(candidate.first_discovered_at)+3600000).toISOString(),verification_method:'Mock permission gate test; not source verification'})).error,'timestamps cannot substitute for source permission and review');
 assert.ok((await a.client.from('external_listing_candidates').update({publication_status:'published'}).eq('id',own.candidate_id)).error,'client publication denied');
 checked(await backend.admin.from('external_reviewers').insert({user_id:b.id,role:'reviewer'}),'temporary fixture reviewer');reviewer=b.id;
 assert.equal(checked(await b.client.from('external_listing_candidates').select('id').eq('id',own.candidate_id),'reviewer access').length,1);
 assert.ok((await b.client.from('external_sources').update({collection_authorized:true}).eq('id',configs[0].id)).error,'reviewer cannot grant marketplace permissions');
 const privateGroup=await invoke(a.client,{...evidence,url:'https://www.facebook.com/groups/123/posts/456'});assert.equal(privateGroup.status,400);
 const forged=await invoke(a.client,{...evidence,p_user_id:b.id});assert.equal(forged.status,400);
 const anonymous=await fetch(backend.url+'/functions/v1/external-submit',{method:'POST',headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify(evidence)});assert.equal(anonymous.status,401);
 checked(await backend.admin.from('external_reviewers').delete().eq('user_id',reviewer),'remove fixture reviewer privilege');reviewer=null;
 for(const id of receipts)checked(await backend.admin.from('external_link_submissions').delete().eq('id',id).in('user_id',accounts),'own receipt cleanup');
 for(const id of candidates)checked(await backend.admin.from('external_listing_candidates').delete().eq('id',id),'own candidate cleanup');
 checked(await a.client.from('listings').delete().eq('id',nativeDraft).eq('owner_id',a.id),'own native draft cleanup');nativeDraft=null;
 checked(await backend.admin.from('listings').delete().eq('id',systemFixture.id).eq('owner_id',identity.user_id),'exact system fixture cleanup');checked(await backend.admin.storage.from('listing-photos').remove([systemFixture.path]),'exact system fixture photo cleanup');systemFixture=null;
 // Completed run records are kept as non-content audit evidence. Auth accounts
 // and the official identity are retained. No source permissions are changed.
 console.log(JSON.stringify({status:'PASS',mode:'MOCK_URL_INTAKE_NOT_LIVE_DISCOVERY',retainedAccountIds:accounts,officialUserId:identity.user_id,removedOnlyOwnReceiptIds:receipts,removedOnlyOwnCandidateIds:candidates,fixtureReviewerPrivilegeRemoved:true,verified:['unavailable source configuration','reserved identity','banned system login','two-user isolation','canonical deduplication','reviewer boundaries','nonpublication','private-group rejection','no marketplace requests']}));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',message:e.message,retainedAccountIds:accounts,receiptIds:receipts,candidateIds:candidates,temporaryReviewerId:reviewer,nativeDraftId:nativeDraft,systemFixture}));process.exitCode=1;}).finally(async()=>{
 if(reviewer){const cleanup=await backend.admin.from('external_reviewers').delete().eq('user_id',reviewer);if(cleanup.error){console.error('Temporary reviewer cleanup failed; administrator attention required for fixture '+reviewer);process.exitCode=1;}}
});
