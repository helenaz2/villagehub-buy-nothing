// Run only after explicit approval for this dedicated backend-only identity.
// Generates a discarded random password, creates no session and sends no email.
const {randomUUID,randomBytes}=require('node:crypto');
const {testBackend,checked}=require('./supabase-test-admin.cjs');
const backend=testBackend();
async function main(){
 const identity=checked(await backend.admin.from('external_system_identity').select('user_id').eq('slot','villagehub-buy-nothing').single(),'reserved identity');
 const id=identity.user_id??randomUUID();
 checked(await backend.admin.rpc('register_external_system_identity',{p_user_id:id}),'one-time designation');
 const existing=await backend.admin.auth.admin.getUserById(id);
 if(!existing.data?.user){
  const created=checked(await backend.admin.auth.admin.createUser({id,email:'villagehub-system@identity.invalid',password:randomBytes(48).toString('base64url'),email_confirm:true,ban_duration:'876000h',user_metadata:{full_name:'VillageHub Buy Nothing',city:'Bay Area',state:'California'}}),'create dedicated identity');
  if(created.user.id!==id)throw Error('Auth identity UUID mismatch; stop setup.');
 }
 checked(await backend.admin.auth.admin.updateUserById(id,{ban_duration:'876000h'}),'disable interactive sign-in');
 const profile={full_name:'VillageHub Buy Nothing',username:'villagehub-buy-nothing',city:'Bay Area',state:'California',bio:'Official VillageHub curator of external links. VillageHub is not the original owner or seller. Use the original source to contact the seller.'};
 const row=checked(await backend.admin.from('profiles').select('id').eq('id',id).maybeSingle(),'system profile');
 checked(await (row?backend.admin.from('profiles').update(profile).eq('id',id):backend.admin.from('profiles').insert({id,...profile})),'designate profile');
 const auth=checked(await backend.admin.auth.admin.getUserById(id),'verify sign-in disabled');if(!auth.user.banned_until||Date.parse(auth.user.banned_until)<=Date.now())throw Error('System sign-in is not disabled.');
 console.log(JSON.stringify({status:'PASS',systemUserId:id,username:profile.username,signInDisabled:true,passwordDiscarded:true,noSessionCreated:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
