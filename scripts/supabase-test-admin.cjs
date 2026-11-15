// Node-only test helper: CLI secret output is captured, never logged or persisted.
const { spawnSync } = require('node:child_process');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('node:crypto');
const ref='iwffztmzngpnwpolhzkc';
function testBackend() {
  if (!process.argv.includes('--approved-development-project='+ref)) throw new Error('Explicit development project argument required.');
  process.loadEnvFile('.env.local');
  const url=process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (new URL(url).hostname!==ref+'.supabase.co') throw new Error('Wrong project.');
  const args=['--yes','supabase@3.1.0','projects','api-keys','--remote='+ref,'--reveal','--output','json'];
  const result=process.platform==='win32'
    ? spawnSync('cmd.exe',['/d','/s','/c','npx '+args.join(' ')],{encoding:'utf8',windowsHide:true})
    : spawnSync('npx',args,{encoding:'utf8'});
  if(result.status!==0) throw new Error('CLI test key access failed. Credentials withheld from output.');
  let payload; try { payload=JSON.parse(result.stdout); } catch { throw new Error('Unexpected CLI response. Credentials withheld.'); }
  const keys=Array.isArray(payload)?payload:payload.api_keys??payload.keys??[];
  const candidates=keys.map(k=>({name:k.name,value:k.api_key??k.key??k.value}));
  const secret=candidates.find(k=>k.name==='service_role')?.value??candidates.find(k=>typeof k.value==='string'&&k.value.startsWith('sb_secret_'))?.value;
  if(!secret||secret.includes('...')) throw new Error('No server test key available.');
  const options={auth:{persistSession:false,autoRefreshToken:false}};
  const pub=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return {ref,url,admin:createClient(url,secret,options),client:()=>createClient(url,pub,options)};
}
function checked(result,label) { if(result.error) throw new Error(label+': '+result.error.message); return result.data; }
async function fixtureAccount(backend,phase,name) {
  const email='villagehub-'+phase+'-'+name.toLowerCase()+'-'+randomUUID()+'@example.test';
  const password='Test-'+randomUUID();
  const created=checked(await backend.admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:phase+' Test '+name,city:'Brooklyn',state:'New York'}}),'Create test account');
  const client=backend.client(); checked(await client.auth.signInWithPassword({email,password}),'Test login');
  return {id:created.user.id,client};
}
module.exports={testBackend,checked,fixtureAccount};
