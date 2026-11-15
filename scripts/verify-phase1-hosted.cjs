// Server-only verification of the explicitly approved disposable development project.
// Secrets are captured from the authenticated CLI in memory; never printed/saved.
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const ref = 'iwffztmzngpnwpolhzkc';
if (!process.argv.includes('--approved-development-project=' + ref)) throw new Error('Explicit development-project argument required.');
process.loadEnvFile('.env.local');
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
if (new URL(url).hostname !== ref + '.supabase.co') throw new Error('Wrong project URL.');
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(command, ['--yes','supabase@3.1.0','projects','api-keys','--remote=' + ref,'--reveal','--output','json'], { shell: process.platform === 'win32', encoding: 'utf8', windowsHide: true });
if (result.status !== 0) throw new Error('Unable to obtain server-only test credentials from CLI; no credentials were printed.');
let payload;
try { payload = JSON.parse(result.stdout); } catch { throw new Error('Unexpected CLI key response; response deliberately not printed.'); }
const entries = Array.isArray(payload) ? payload : payload.api_keys ?? payload.keys ?? [];
const candidates = entries.map(k => ({ name: k.name, type: k.type, value: k.api_key ?? k.key ?? k.value }));
const secret = candidates.find(k => k.name === 'service_role')?.value ?? candidates.find(k => typeof k.value === 'string' && k.value.startsWith('sb_secret_'))?.value;
if (!secret || secret.includes('...')) throw new Error('A server test key was unavailable; no keys were printed.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const pub = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const a = createClient(url, pub, options), b = createClient(url, pub, options);
const fixtures = [];
function check(result, label) { if (result.error) throw new Error(label + ': ' + result.error.message); return result.data; }
async function main() {
  const suffix = randomUUID();
  for (const [name, client] of [['A',a],['B',b]]) {
    const email = 'villagehub-phase1-' + name.toLowerCase() + '-' + suffix + '@example.test';
    const password = 'Test-' + randomUUID();
    const created = check(await admin.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { full_name: 'Phase 1 Test ' + name, city: 'Brooklyn', state: 'New York' } }), 'Create dedicated account');
    fixtures.push({ id: created.user.id, client });
    const denied = await client.auth.signInWithPassword({ email, password });
    assert.ok(denied.error, 'unconfirmed login must be denied');
    check(await admin.auth.admin.updateUserById(created.user.id, { email_confirm: true }), 'Confirm only the test account');
    const login = check(await client.auth.signInWithPassword({ email, password }), 'Real password login');
    assert.equal(login.user.id, created.user.id);
  }
  const [alice,bob] = fixtures;
  const own = check(await a.from('profiles').select('*').eq('id',alice.id).single(), 'Persisted profile');
  assert.equal(own.full_name,'Phase 1 Test A'); assert.ok(!('street' in own)); assert.ok(!('email' in own));
  check(await a.from('profiles').update({ bio: 'Dedicated Phase 1 RLS test fixture' }).eq('id',alice.id), 'Own profile update');
  const publicRead = check(await b.from('profiles').select('bio').eq('id',alice.id).single(), 'Other user public profile read');
  assert.equal(publicRead.bio,'Dedicated Phase 1 RLS test fixture');
  const forbidden = check(await b.from('profiles').update({ bio: 'Must not change' }).eq('id',alice.id).select('id'), 'Cross-user update');
  assert.equal(forbidden.length,0);
  const identity = await a.from('profiles').update({ created_at:'2000-01-01' }).eq('id',alice.id);
  assert.ok(identity.error, 'membership date cannot be forged');
  check(await a.from('account_addresses').insert({ user_id:alice.id,street:'PRIVATE TEST FIXTURE - NOT A REAL ADDRESS' }), 'Private fixture');
  const hidden = check(await b.from('account_addresses').select('*').eq('user_id',alice.id), 'Private isolation'); assert.equal(hidden.length,0);
  const noChange = check(await b.from('account_addresses').update({ street:'Must not change' }).eq('user_id',alice.id).select('user_id'), 'Private cross-user update'); assert.equal(noChange.length,0);
  const street = check(await a.from('account_addresses').select('street').eq('user_id',alice.id).single(), 'Own private address'); assert.equal(street.street,'PRIVATE TEST FIXTURE - NOT A REAL ADDRESS');
  const fakeOwner = await a.from('account_addresses').insert({ user_id:bob.id,street:'Must not insert' }); assert.ok(fakeOwner.error);
  const session = check(await a.auth.getSession(), 'Session').session;
  const restored = createClient(url,pub,options);
  const fresh = check(await restored.auth.setSession({ access_token:session.access_token,refresh_token:session.refresh_token }), 'Session recreation'); assert.equal(fresh.user.id,alice.id);
  const persisted = check(await restored.from('profiles').select('bio').eq('id',alice.id).single(), 'Persistent data after client recreation'); assert.equal(persisted.bio,'Dedicated Phase 1 RLS test fixture');
  const anon = createClient(url,pub,options);
  assert.ok((await anon.from('account_addresses').select('street')).error, 'anonymous private read denied');
  assert.ok((await anon.from('profiles').select('id')).error, 'anonymous profile read denied');
  check(await restored.auth.signOut({ scope:'local' }), 'Sign out');
  assert.equal(check(await restored.auth.getSession(), 'Session cleared').session,null);
  console.log(JSON.stringify({ status:'PASS', project:ref, accounts:fixtures.map(f => f.id), verified:['unconfirmed login denied','real password login','signup trigger','own profile persistence','public profile read','cross-user edit denial','immutable membership date','private street isolation','private insert denial','session recreation','persistent data','anonymous denial','logout'], retainedFixtures:true, emailDeliveryTested:false, nativeUiTested:false }));
}
main().catch(error => { console.error(JSON.stringify({ status:'FAIL', message:error.message, retainedAccountIds:fixtures.map(f => f.id) })); process.exitCode=1; });
