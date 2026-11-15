// Exact fixtures left by the approved Phase 4 test's permission assertion.
const {testBackend,checked}=require('./supabase-test-admin.cjs');
const backend=testBackend(),owner='654743ed-20c9-4ba6-9d03-6775d08c0fe0',requester='61e865c0-b0b3-4e49-8e82-1c422b104010';
const fixtures=[{listing:'6bfc1f86-3f90-4487-b177-19657e651589',conversation:'519b2743-668c-4b60-9e62-cfe41e0ff2ad'},{listing:'b98ad598-c9b4-43ed-81b6-4b7051372483',conversation:'c651702a-cc96-432b-9fe6-5c32b0f52fff'}];
async function main(){
 for(const f of fixtures){
  const listing=checked(await backend.admin.from('listings').select('owner_id,title').eq('id',f.listing).single(),'verify exact listing');
  const thread=checked(await backend.admin.from('conversations').select('host_id,requester_id,listing_id').eq('id',f.conversation).single(),'verify exact conversation');
  if(listing.owner_id!==owner || !listing.title.startsWith('Phase4 fixture ') || thread.host_id!==owner || thread.requester_id!==requester || thread.listing_id!==f.listing) throw new Error('Fixture identity mismatch.');
 }
 for(const f of fixtures){
  checked(await backend.admin.from('conversations').delete().eq('id',f.conversation).eq('host_id',owner).eq('requester_id',requester),'exact conversation cleanup');
  checked(await backend.admin.from('listings').delete().eq('id',f.listing).eq('owner_id',owner),'exact listing cleanup');
  checked(await backend.admin.storage.from('listing-photos').remove([owner+'/'+f.listing+'/phase4.png']),'exact photo cleanup');
 }
 console.log(JSON.stringify({status:'PASS',removedOnlyOwnFixtures:fixtures,authAccountsRetained:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
