// Only the explicitly identified fixture left by the failed Phase 2 verification.
const {testBackend,checked}=require('./supabase-test-admin.cjs');
const backend=testBackend();
const id='8c7412a0-2419-4c03-921a-28342c337760';
const owner='dcc07b6b-1d49-4a61-885b-068f133b77a3';
(async()=>{
 const row=checked(await backend.admin.from('listings').select('id,owner_id,title').eq('id',id).maybeSingle(),'Read exact test fixture');
 if(!row){console.log('Exact failed test listing already absent.');return;}
 if(row.owner_id!==owner||!row.title.startsWith('phase2'))throw new Error('Fixture identity mismatch: refusing cleanup.');
 const files=checked(await backend.admin.storage.from('listing-photos').list(owner+'/'+id),'List exact fixture folder');
 checked(await backend.admin.from('listings').delete().eq('id',id).eq('owner_id',owner),'Delete approved test fixture only');
 if(files.length)checked(await backend.admin.storage.from('listing-photos').remove(files.map(file=>owner+'/'+id+'/'+file.name)),'Remove approved fixture photos only');
 console.log(JSON.stringify({removedListing:id,removedObjectCount:files.length,accountsRetained:true}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
