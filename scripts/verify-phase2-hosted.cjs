// Requires separate approval for Phase 2 and removal of this run's own fixtures.
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {testBackend,checked,fixtureAccount}=require('./supabase-test-admin.cjs');
const backend=testBackend(); const accounts=[]; const created=[];
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lGQAAAAASUVORK5CYII=','base64');
function service(client) {const m={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/services/listings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext(code,{exports:m.exports,require:id=>id==='@/lib/supabase'?{getSupabase:()=>client}:id==='@/lib/photo-bytes'?{readPhoto:async()=>({bytes:png.buffer.slice(png.byteOffset,png.byteOffset+png.byteLength),mime:'image/png'})}:{}});return m.exports;}
async function main(){
 const a=await fixtureAccount(backend,'phase2','A');accounts.push(a.id);const b=await fixtureAccount(backend,'phase2','B');accounts.push(b.id);
 const api=service(a.client),other=service(b.client);const token='phase2'+randomUUID().replaceAll('-','');
 const item={id:'client-id-ignored',hostId:a.id,title:token,description:'',photos:['test://photo.png'],category:'Other',condition:'Good condition',conditionNote:'',size:'Small',color:'White',neighborhood:'Brooklyn',city:'Brooklyn',tags:['test'],features:[],materials:'',fabric:'',status:'available',distance:'',postedLabel:'',saves:0};
 const id=await api.saveListing(item,a.id);created.push(id);assert.notEqual(id,item.id);
 let live=await api.getListing(id);assert.equal(live.title,token);assert.equal(live.photos.length,1);assert.equal(live.photoPaths.length,1);
 const signed=await fetch(live.photos[0]);assert.equal(signed.status,200);
 assert.equal((await other.getListing(id)).id,id,'other user sees published post');
 const denied=checked(await b.client.from('listings').update({title:'Injected'}).eq('id',id).select('id'),'cross-user edit');assert.equal(denied.length,0);
 const otherPhoto=await b.client.rpc('publish_listing_photos',{p_listing_id:id,p_paths:live.photoPaths});assert.ok(otherPhoto.error);
 const ownIdSpoof=await a.client.from('listings').insert({...{owner_id:a.id,category_id:(await api.getCategories())[0].id,title:'Bad',condition:'Fair',size:'Small',color:'White',neighborhood:'Brooklyn',city:'Brooklyn'},created_at:'2000-01-01'});assert.ok(ownIdSpoof.error);
 const invalid=await a.client.from('listings').update({title:' '}).eq('id',id);assert.ok(invalid.error);
 const path=live.photoPaths[0];const stolen=await b.client.storage.from('listing-photos').upload(a.id+'/'+id+'/stolen.png',png,{contentType:'image/png'});assert.ok(stolen.error);
 await a.client.storage.from('listing-photos').remove([path]);assert.equal((await a.client.storage.from('listing-photos').download(path)).error,null,'cannot remove referenced photo directly');
 const pubUrl=a.client.storage.from('listing-photos').getPublicUrl(path).data.publicUrl;assert.notEqual((await fetch(pubUrl)).status,200,'bucket is private');
 await api.setSaved(a.id,id,true);await api.setSaved(a.id,id,true);assert.equal((await api.getSavedIds()).filter(key=>key===id).length,1);
 assert.equal((await other.getSavedIds()).includes(id),false);
 const savedTamper=checked(await b.client.from('saved_items').delete().eq('user_id',a.id).eq('listing_id',id).select('listing_id'),'saved isolation');assert.equal(savedTamper.length,0);
 assert.equal((await api.listListings({query:token,category:'Other'}))[0].id,id);
 assert.ok((await api.listListings({offset:20})).length<=20);
 await api.saveListing({...live,photos:[...live.photos,'test://second.png']},a.id,live);live=await api.getListing(id);assert.equal(live.photos.length,2);
 await api.saveListing({...live,photos:[live.photos[1]]},a.id,live);live=await api.getListing(id);assert.equal(live.photos.length,1);assert.notEqual(live.photoPaths[0],path);
 assert.ok((await a.client.storage.from('listing-photos').createSignedUrl(path,60)).error,'removed edit photo cannot receive a fresh signed URL');
 const remaining=checked(await a.client.storage.from('listing-photos').list(a.id+'/'+id),'storage cleanup list');assert.equal(remaining.some(file=>file.name===path.split('/').at(-1)),false,'removed photo object absent from Storage metadata');
 await api.setListingStatus(id,'claimed');assert.equal((await api.getListing(id)).status,'claimed');assert.equal((await api.listListings({query:token})).length,0);
 await api.setListingStatus(id,'available');assert.equal((await api.listListings({query:token}))[0].id,id);
 const reloaded=service(a.client);assert.equal((await reloaded.getListing(id)).id,id);
 const latest=await api.getListing(id);await api.deleteListing(latest);assert.equal(await api.getListing(id),null);assert.ok((await a.client.storage.from('listing-photos').createSignedUrl(latest.photoPaths[0],60)).error);
 assert.equal((await api.getSavedIds()).includes(id),false,'saved row cascades after own test post removal');
 console.log(JSON.stringify({status:'PASS',project:backend.ref,retainedAccountIds:accounts,removedOnlyOwnListingFixtures:created,verified:['server IDs','real private upload and signed download','published reads','cross-user edit/photo denial','server validation','private bucket','saved deduplication/isolation','search','pagination request','ordered photo edit/cleanup','claim/relist','data reload','own deletion and storage cleanup']}));
}
main().catch(e=>{console.error(JSON.stringify({status:'FAIL',message:e.message,retainedAccountIds:accounts,createdListingIds:created}));process.exitCode=1;});
