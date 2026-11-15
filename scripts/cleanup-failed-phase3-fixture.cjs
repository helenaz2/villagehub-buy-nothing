// Exact fixture from the first approved Phase 3 run; Auth accounts are retained.
const {testBackend,checked}=require('./supabase-test-admin.cjs');
const backend=testBackend();
const host='e3c560ca-e30e-4271-8583-3ecb981dd112',requester='03d1b6e4-5d0e-401f-83e7-05c92d0bff67';
const listing='a4689592-f988-486b-be6e-3feddcba5fc3',conversation='8cdebbd2-cc15-4993-bf05-a27494ec9f25';
const path=host+'/'+listing+'/phase3.png';
async function main(){
 const row=checked(await backend.admin.from('listings').select('id,owner_id,title').eq('id',listing).single(),'verify exact test listing');
 const thread=checked(await backend.admin.from('conversations').select('id,host_id,requester_id,listing_id').eq('id',conversation).single(),'verify exact test conversation');
 if(row.owner_id!==host || !row.title.startsWith('Phase3 fixture ') || thread.host_id!==host || thread.requester_id!==requester || thread.listing_id!==listing) throw new Error('Fixture identity mismatch; no deletion performed.');
 checked(await backend.admin.from('conversations').delete().eq('id',conversation).eq('host_id',host).eq('requester_id',requester),'exact conversation cleanup');
 checked(await backend.admin.from('listings').delete().eq('id',listing).eq('owner_id',host),'exact listing cleanup');
 checked(await backend.admin.storage.from('listing-photos').remove([path]),'exact photo cleanup');
 console.log(JSON.stringify({status:'PASS',removedOnly:{conversation,listing,path},authAccountsRetained:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
