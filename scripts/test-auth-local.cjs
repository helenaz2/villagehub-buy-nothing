// Runs against a disposable LOCAL Supabase stack only. Never a hosted project.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('node:crypto');
const url = process.env.SUPABASE_TEST_URL || 'http://127.0.0.1:54321';
const parsed = new URL(url);
if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error('These tests refuse to create users in a hosted project.');
const anon = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
if (!anon || !secret) throw new Error('Set the LOCAL test keys from supabase status in server-only SUPABASE_TEST_* variables. Never use EXPO_PUBLIC_ for the service-role key.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, secret, options);
const alice = createClient(url, anon, options);
const bob = createClient(url, anon, options);
const users = [];
const suffix = randomUUID();
const password = 'Test-only-' + randomUUID();
before(async () => {
  for (const [name, client] of [['Alice', alice], ['Bob', bob]]) {
    const email = name.toLowerCase() + '-' + suffix + '@example.test';
    const result = await client.auth.signUp({ email, password, options: { data: { full_name: name, city: 'Brooklyn', state: 'New York' } } });
    assert.ifError(result.error); assert.ok(result.data.user); users.push(result.data.user.id);
    assert.equal(result.data.session, null, 'email confirmation must be enabled');
    const denied = await client.auth.signInWithPassword({ email, password });
    assert.ok(denied.error, 'unconfirmed account cannot log in');
    // Email delivery/callbacks are tested separately in the local mail UI.
    const confirmed = await admin.auth.admin.updateUserById(result.data.user.id, { email_confirm: true });
    assert.ifError(confirmed.error);
    const loggedIn = await client.auth.signInWithPassword({ email, password });
    assert.ifError(loggedIn.error); assert.ok(loggedIn.data.session);
  }
});
after(async () => { for (const id of users) { const result = await admin.auth.admin.deleteUser(id); assert.ifError(result.error); } });
test('real Auth IDs map to profiles persisted by the signup trigger', async () => {
  const result = await alice.from('profiles').select('id,full_name').eq('id', users[0]).single();
  assert.ifError(result.error); assert.equal(result.data.full_name, 'Alice');
});
test('two accounts cannot change one anothers profiles', async () => {
  const changed = await alice.from('profiles').update({ full_name: 'Injected' }).eq('id', users[1]).select('id');
  assert.ifError(changed.error); assert.equal(changed.data.length, 0);
  const unchanged = await bob.from('profiles').select('full_name').eq('id', users[1]).single();
  assert.ifError(unchanged.error); assert.equal(unchanged.data.full_name, 'Bob');
});
test('street is owner-only and does not appear in public profiles', async () => {
  const inserted = await alice.from('account_addresses').insert({ user_id: users[0], street: 'Private local test street' });
  assert.ifError(inserted.error);
  const hidden = await bob.from('account_addresses').select('*').eq('user_id', users[0]);
  assert.ifError(hidden.error); assert.equal(hidden.data.length, 0);
  const forged = await bob.from('account_addresses').update({ street: 'Injected' }).eq('user_id', users[0]).select('user_id');
  assert.ifError(forged.error); assert.equal(forged.data.length, 0);
  const own = await alice.from('account_addresses').select('street').eq('user_id', users[0]).single();
  assert.ifError(own.error); assert.equal(own.data.street, 'Private local test street');
});
test('refreshable Auth session survives recreation of the SDK client', async () => {
  const { data } = await alice.auth.getSession();
  const reloaded = createClient(url, anon, options);
  const restored = await reloaded.auth.setSession({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  assert.ifError(restored.error); assert.equal(restored.data.user.id, users[0]);
});
