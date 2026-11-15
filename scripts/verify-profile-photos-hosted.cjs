// Requires explicit approval for migration 008 and these exact fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {testBackend,checked,fixtureAccount}=require('./supabase-test-admin.cjs');
const backend=testBackend(),accounts=[],paths=[];const bucket='profile-photos';
async function main(){
 const a=await fixtureAccount(backend,'avatar','PhotoOwner'),b=await fixtureAccount(backend,'avatar','PhotoViewer');accounts.push(a.id,b.id);
 const path=a.id+'/avatar-test-'+Date.now()+'.png';paths.push(path);
 const bytes=fs.readFileSync('scripts/fixtures/mug.png');
 assert.ok((await b.client.storage.from(bucket).upload(path,bytes,{contentType:'image/png'})).error,'foreign upload denied');
 checked(await a.client.storage.from(bucket).upload(path,bytes,{contentType:'image/png'}),'own upload');
 assert.ok((await b.client.storage.from(bucket).createSignedUrl(path,60)).error,'unpublished photo private');
 assert.ok((await a.client.from('profiles').update({avatar_path:a.id+'/missing.png'}).eq('id',a.id)).error,'missing upload denied');
 assert.ok((await b.client.from('profiles').update({avatar_path:path}).eq('id',b.id)).error,'foreign path denied');
 checked(await a.client.from('profiles').update({avatar_path:path}).eq('id',a.id),'set avatar');
 const signed=checked(await b.client.storage.from(bucket).createSignedUrl(path,60),'neighbor signed read');
 assert.equal((await fetch(signed.signedUrl)).status,200,'signed photo renders');
 assert.ok((await backend.client().storage.from(bucket).createSignedUrl(path,60)).error,'anonymous read denied');
 const tamper=await b.client.from('profiles').update({avatar_path:null}).eq('id',a.id).select('id');assert.equal(tamper.data?.length??0,0,'foreign edit denied');
 checked(await b.client.storage.from(bucket).remove([path]),'foreign deletion filtered');
 assert.ok(!(await a.client.storage.from(bucket).download(path)).error,'foreign delete did not remove object');
 checked(await a.client.storage.from(bucket).remove([path]),'current avatar deletion filtered');
 assert.ok(!(await a.client.storage.from(bucket).download(path)).error,'referenced photo retained');
 const large=a.id+'/oversize.png';assert.ok((await a.client.storage.from(bucket).upload(large,new Uint8Array(2097153),{contentType:'image/png'})).error,'size limit enforced');
 assert.ok((await a.client.storage.from(bucket).upload(a.id+'/unsafe.svg',Buffer.from('<svg/>'),{contentType:'image/svg+xml'})).error,'SVG refused');
 console.log(JSON.stringify({status:'PASS',retainedAccountIds:accounts,checks:['own upload','owner-only edit','private unreferenced object','signed neighbor view','anonymous denied','foreign deletion denied','current avatar retained','missing and foreign paths denied','size and MIME limits']}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{
 for(const id of accounts){const result=await backend.admin.from('profiles').update({avatar_path:null}).eq('id',id);if(result.error){console.error('Fixture profile cleanup failed: '+id);process.exitCode=1;}}
 if(paths.length){const result=await backend.admin.storage.from(bucket).remove(paths);if(result.error){console.error('Fixture photo cleanup failed');process.exitCode=1;}}
});
