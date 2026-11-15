// Requires separate migration/deployment/fixture/paid-test approval. A normal
// run uses four AI calls; cached retry and direct SQL tests do not call OpenAI.
const assert=require('node:assert/strict'),fs=require('node:fs'),{randomUUID}=require('node:crypto');
const {testBackend,checked,fixtureAccount}=require('./supabase-test-admin.cjs');
const backend=testBackend(),accounts=[],fixtures=[],keys=[];
async function invoke(client,body){const session=checked(await client.auth.getSession(),'session').session;const response=await fetch(backend.url+'/functions/v1/listing-recommendations',{method:'POST',headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};}
async function main(){
 const a=await fixtureAccount(backend,'recommendation','Searcher'),b=await fixtureAccount(backend,'recommendation','Host');accounts.push(a.id,b.id);
 checked(await a.client.from('profiles').update({city:'Berkeley'}).eq('id',a.id),'own profile city');
 const category=checked(await b.client.from('categories').select('id').eq('name','Other').single(),'category');
 const token='reco'+randomUUID().replaceAll('-','').slice(0,20);
 async function listing(label,city,materials,status='available'){
  const row=checked(await b.client.from('listings').insert({owner_id:b.id,category_id:category.id,title:token+' '+label,description:'Recommendation test fixture.',condition:'Good condition',size:'Small',color:'Natural',materials,neighborhood:'Downtown',city}).select('id').single(),'fixture listing');
  const fixture={id:row.id,owner:b.id,path:b.id+'/'+row.id+'/fixture.png',deleted:false};fixtures.push(fixture);
  {checked(await b.client.storage.from('listing-photos').upload(fixture.path,fs.readFileSync('scripts/fixtures/mug.png'),{contentType:'image/png'}),'fixture photo');checked(await b.client.rpc('publish_listing_photos',{p_listing_id:row.id,p_paths:[fixture.path]}),'publish');if(status!=='available')checked(await b.client.from('listings').update({status}).eq('id',row.id),'claim fixture');}
  return fixture;
 }
 const desk=await listing('desk','Berkeley','Wood'),metal=await listing('desk','Oakland','Metal'),chair=await listing('chair','Berkeley','Oak'),clothes=await listing('baby clothes','Berkeley','Cotton'),claimed=await listing('desk','Berkeley','Wood','claimed'),draft=await listing('desk','Berkeley','Wood','draft'),deleted=await listing('desk','Berkeley','Wood');
 checked(await b.client.from('listings').delete().eq('id',deleted.id).eq('owner_id',b.id),'deleted fixture');checked(await b.client.storage.from('listing-photos').remove([deleted.path]),'deleted photo');deleted.deleted=true;
 const sql=(args,client=a.client)=>client.rpc('search_listing_recommendations',{p_items:[token+' desk'],p_attributes:[],p_city:null,p_neighborhood:null,p_preferred_city:'Berkeley',...args});
 const general=checked(await sql({}),'indexed search');assert.deepEqual(general.map(row=>row.id),[desk.id,metal.id],'profile city ranks first, claimed/deleted/draft excluded');
 const ownerView=checked(await sql({},b.client),'owner search excludes own draft');assert.equal(ownerView.some(row=>row.id===draft.id),false);
 const wood=checked(await sql({p_attributes:[['wood','wooden','oak','pine']]}),'material search');assert.deepEqual(wood.map(row=>row.id),[desk.id],'materials field participates without backfill');
 const explicit=checked(await sql({p_city:'berkeley'}),'explicit city');assert.deepEqual(explicit.map(row=>row.id),[desk.id]);
 assert.equal(checked(await sql({p_city:'Neverland'}),'empty search').length,0);
 assert.ok((await sql({p_items:[]})).error);assert.ok((await sql({p_attributes:[['x'.repeat(41)]]})).error);
 const anon=backend.client();assert.ok((await sql({},anon)).error,'anonymous SQL denied');
 const anonymous=await fetch(backend.url+'/functions/v1/listing-recommendations',{method:'POST',headers:{apikey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json'},body:JSON.stringify({requestKey:'x',messages:['desk'],previousPlan:null})});assert.equal(anonymous.status,401);
 const invalid=await invoke(a.client,{requestKey:'invalid',messages:['x'.repeat(501)],previousPlan:null});assert.equal(invalid.status,400);
 let messages=[],previousPlan=null;
 async function ask(text){messages=[...messages.slice(-5),text];const body={requestKey:randomUUID(),messages:[...messages],previousPlan};keys.push(body.requestKey);const result=await invoke(a.client,body);assert.equal(result.status,200,result.data.message);previousPlan=result.data.plan;return {body,reply:result.data};}
 const first=await ask('Find me a free desk in Berkeley');assert.ok(first.reply.items.some(item=>item.id===desk.id));assert.ok(first.reply.items.every(item=>item.city.toLowerCase()==='berkeley'&&item.status==='available'));
 const refined=await ask('Only show wooden ones');assert.ok(refined.reply.items.some(item=>item.id===desk.id));assert.ok(refined.reply.plan.attributes.length>0);
 const changed=await ask('What about chairs');assert.ok(changed.reply.items.some(item=>item.id===chair.id));assert.equal(changed.reply.items.some(item=>item.id===desk.id),false);
 const baby=await ask('Show me baby clothes near me');assert.ok(baby.reply.items.some(item=>item.id===clothes.id));assert.equal(baby.reply.plan.location,'nearby');
 for(const item of [...first.reply.items,...changed.reply.items,...baby.reply.items]){
  assert.equal(item.status,'available');assert.equal([claimed.id,draft.id,deleted.id].includes(item.id),false);
  const actual=checked(await a.client.from('listings').select('id,title,city,status').eq('id',item.id).single(),'grounded listing');assert.equal(actual.title,item.title);assert.equal(actual.city,item.city);assert.equal(actual.status,'available');
 }
 assert.ok(first.reply.items[0].imageUrl);assert.equal((await fetch(first.reply.items[0].imageUrl)).status,200,'real signed photo');
 checked(await b.client.from('listings').update({status:'claimed'}).eq('id',desk.id),'claim after response');
 const retry=await invoke(a.client,first.body);assert.equal(retry.status,200);assert.equal(retry.data.items.some(item=>item.id===desk.id),false,'cached plan cannot return now-claimed listing');
 const lease=checked(await backend.admin.from('ai_requests').select('attempts,status').eq('user_id',a.id).eq('kind','recommendation').eq('request_key',first.body.requestKey).single(),'cache ledger');assert.equal(lease.attempts,1);
 // SQL-only cached fixture exercises request throttling without a paid call.
 const burstKey=randomUUID(),burstArgs={p_user_id:b.id,p_kind:'recommendation',p_request_key:burstKey,p_payload_hash:'a'.repeat(64),p_proposal_id:null};
 const burst=checked(await backend.admin.rpc('reserve_ai_request',burstArgs),'burst reservation');assert.equal(burst.status,'reserved');
 checked(await backend.admin.rpc('finish_ai_request',{p_id:burst.id,p_reservation:burst.reservation,p_success:true,p_result:first.reply.plan}),'burst fixture cache');
 const burstResults=await Promise.all(Array.from({length:41},()=>backend.admin.rpc('reserve_ai_request',burstArgs)));
 assert.ok(burstResults.map(result=>checked(result,'cached request burst')).some(row=>row.status==='throttled'),'cached requests are rate limited too');
 for(const f of fixtures){if(f.deleted)continue;checked(await b.client.from('listings').delete().eq('id',f.id).eq('owner_id',b.id),'own listing cleanup');checked(await b.client.storage.from('listing-photos').remove([f.path]),'own photo cleanup');}
 checked(await backend.admin.from('ai_requests').delete().eq('user_id',a.id).eq('kind','recommendation').in('request_key',keys),'exact AI fixture cleanup');
 checked(await backend.admin.from('ai_requests').delete().eq('user_id',b.id).eq('kind','recommendation').eq('request_key',burstKey),'exact quota fixture cleanup');
 console.log(JSON.stringify({status:'PASS',retainedAccountIds:accounts,removedOwnListingFixtures:fixtures.map(f=>f.id),paidCallsExpected:4,verified:['authorization','full-text search','materials','location priority','explicit city','claimed/deleted/draft exclusion','real conversational follow-ups','database-grounded cards','signed images','cached live requery']}));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',message:e.message,retainedAccountIds:accounts,fixtures,requestKeys:keys}));process.exitCode=1;});
