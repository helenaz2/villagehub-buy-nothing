// Service contract tests. These do not replace real Auth/SQL/RLS integration tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
function load(file, deps = {}, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports: module.exports, require: id => { if (!(id in deps)) throw new Error('Unexpected import: ' + id); return deps[id]; }, URL, ...globals });
  return module.exports;
}
function authService(auth) {
  return load('src/services/auth.ts', {
    'expo-linking': { createURL: path => 'villagehubbuynothing://' + path.replace(/^\//, '') },
    'react-native': { Platform: { OS: 'web' } },
    '@/lib/backend-config': { backendConfig: {} },
    '@/lib/supabase': { getSupabase: () => ({ auth }) },
  }, { window: { location: { origin: 'http://localhost:8081' } } });
}

test('confirmation code verifies email on this client without a browser exchange',async()=>{
 let sent;const session={user:{id:'new-user'}};
 const api=authService({verifyOtp:async input=>{sent=input;return {data:{session},error:null};}});
 const result=await api.verifySignupCode(' alice@example.test ',' 001234 ');
 assert.deepEqual(JSON.parse(JSON.stringify(sent)),{email:'alice@example.test',token:'001234',type:'email'});
 assert.equal(result.session,session);
});
test('malformed confirmation codes are refused before contacting Auth',async()=>{
 let calls=0;const api=authService({verifyOtp:async()=>{calls++;}});
 for(const code of ['','123','abcd12','12345678901'])await assert.rejects(api.verifySignupCode('alice@example.test',code));
 await assert.rejects(api.verifySignupCode('invalid','123456'));assert.equal(calls,0);
});
test('expired or reused codes do not produce a session',async()=>{
 const expired=new Error('Token has expired or is invalid');
 await assert.rejects(authService({verifyOtp:async()=>({data:{session:null},error:expired})}).verifySignupCode('alice@example.test','123456'),/expired or is invalid/);
 await assert.rejects(authService({verifyOtp:async()=>({data:{session:null},error:null})}).verifySignupCode('alice@example.test','123456'),/No session/);
});
test('resend requests only an existing signup confirmation, without a password or redirect',async()=>{
 let sent;await authService({resend:async input=>{sent=input;return {error:null};}}).resendSignupCode(' alice@example.test ');
 assert.deepEqual(JSON.parse(JSON.stringify(sent)),{type:'signup',email:'alice@example.test'});
});
test('resend throttling errors propagate instead of claiming an email was sent',async()=>{
 await assert.rejects(authService({resend:async()=>({error:new Error('Email rate limit exceeded')})}).resendSignupCode('alice@example.test'),/rate limit/);
});
test('signup sends public metadata only and correct confirmation redirect', async () => {
  let sent;
  const api = authService({ signUp: async input => { sent = input; return { data: { session: null }, error: null }; } });
  const data = await api.signUp({ name: ' Alice ', email: ' alice@example.test ', password: 'password123', city: ' Brooklyn ', state: 'New York', street: 'Private Street' });
  assert.equal(data.session, null);
  assert.equal(sent.email, 'alice@example.test');
  assert.equal(sent.options.emailRedirectTo, 'http://localhost:8081/auth/callback');
  assert.equal(sent.options.data.full_name, 'Alice');
  assert.equal(sent.options.data.city, 'Brooklyn');
  assert.ok(!('street' in sent.options.data));
});
test('login errors propagate; no demo/session fallback', async () => {
  const api = authService({ signInWithPassword: async () => ({ data: null, error: new Error('Invalid login credentials') }) });
  await assert.rejects(api.signIn('bad@example.test', 'incorrect'), /Invalid login/);
});
test('password reset uses reset route and does not request a session', async () => {
  let sent;
  const api = authService({ resetPasswordForEmail: async (...args) => { sent = args; return { error: null }; } });
  await api.sendPasswordReset(' alice@example.test ');
  assert.equal(sent[0], 'alice@example.test');
  assert.equal(sent[1].redirectTo, 'http://localhost:8081/reset-password');
});
test('a callback code is exchanged once despite duplicate render/deep-link events', async () => {
  let calls = 0;
  const api = authService({ exchangeCodeForSession: async code => { calls++; assert.equal(code, 'one-time'); return { error: null }; } });
  await Promise.all([api.completeAuthLink('http://localhost:8081/auth/callback?code=one-time'), api.completeAuthLink('http://localhost:8081/auth/callback?code=one-time')]);
  assert.equal(calls, 1);
});
test('expired/denied callbacks produce errors without logging tokens', async () => {
  const api = authService({ exchangeCodeForSession: async () => ({ error: new Error('Expired link') }) });
  await assert.rejects(api.completeAuthLink('http://localhost:8081/auth/callback?code=expired'), /Expired link/);
  await assert.rejects(api.completeAuthLink('http://localhost:8081/auth/callback?error_description=Denied'), /Denied/);
});
test('public profile mapper has no street/email or fabricated ratings', () => {
  const api = load('src/services/profiles.ts', { '@/lib/supabase': { getSupabase: () => {} }, '@/lib/backend-config': {backendConfig:{ratings:false}}, './ratings':{} });
  const p = api.profileToPerson({ id: 'user-a', full_name: 'Alice', username: 'alice', bio: '', city: 'Brooklyn', state: 'New York', created_at: '2026-11-14T12:00:00Z' });
  assert.equal(p.id, 'user-a'); assert.equal(p.handle, '@alice'); assert.equal(p.memberSince, '2026');
  assert.equal(p.rating, 0); assert.ok(!('street' in p)); assert.ok(!('email' in p));
});
test('Supabase client cannot create a shared authenticated SSR singleton', () => {
  let created = false;
  const api = load('src/lib/supabase.ts', {
    'react-native-url-polyfill/auto': {}, '@react-native-async-storage/async-storage': {},
    '@supabase/supabase-js': { createClient: () => { created = true; } },
    'react-native': { Platform: { OS: 'web' } },
    './backend-config': { backendConfig: { url: 'https://example.supabase.co', publishableKey: 'public-test-key' }, configurationError: () => null },
  });
  assert.throws(() => api.getSupabase(), /never in web SSR/); assert.equal(created, false);
});
test('native session client persists and refreshes with process lock', () => {
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const lock = () => {};
  let options;
  const api = load('src/lib/supabase.ts', {
    'react-native-url-polyfill/auto': {}, '@react-native-async-storage/async-storage': { __esModule: true, default: storage },
    '@supabase/supabase-js': { createClient: (_url, _key, opts) => { options = opts; return {}; }, processLock: lock },
    'react-native': { Platform: { OS: 'ios' } },
    './backend-config': { backendConfig: { url: 'https://example.supabase.co', publishableKey: 'public-test-key' }, configurationError: () => null },
  });
  const a = api.getSupabase(); assert.equal(api.getSupabase(), a);
  assert.equal(options.auth.storage, storage); assert.equal(options.auth.persistSession, true);
  assert.equal(options.auth.autoRefreshToken, true); assert.equal(options.auth.flowType, 'pkce'); assert.equal(options.auth.lock, lock);
});
test('demo mode is opt-in and Next.js env variables cannot enable/configure Expo', () => {
  const api = load('src/lib/backend-config.ts', {}, { process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://wrong.supabase.co' } } });
  assert.equal(api.backendConfig.demo, false); assert.ok(api.configurationError());
});
test('browser sessions use browser persistence and PKCE without native locks', () => {
  let options;
  const localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const api = load('src/lib/supabase.ts', {
    'react-native-url-polyfill/auto': {}, '@react-native-async-storage/async-storage': {},
    '@supabase/supabase-js': { createClient: (_url, _key, opts) => { options = opts; return {}; } },
    'react-native': { Platform: { OS: 'web' } },
    './backend-config': { backendConfig: { url: 'https://example.supabase.co', publishableKey: 'public-test-key' }, configurationError: () => null },
  }, { window: { localStorage } });
  api.getSupabase(); assert.equal(options.auth.storage, localStorage);
  assert.equal(options.auth.persistSession, true); assert.equal(options.auth.detectSessionInUrl, false);
  assert.ok(!('lock' in options.auth));
});
test('a pending private street can only be applied to the matching email account', async () => {
  let raw = null;
  const saved = [];
  const localStorage = { getItem: () => raw, setItem: (_key, value) => { raw = value; }, removeItem: () => { raw = null; } };
  const api = load('src/services/pending-address.ts', {
    '@react-native-async-storage/async-storage': {}, 'react-native': { Platform: { OS: 'web' } },
    './profiles': { saveStreet: async (id, street) => saved.push({ id, street }) },
  }, { window: { localStorage } });
  await api.rememberPendingStreet(' Alice@Example.Test ', ' Private Street ');
  await api.savePendingStreet({ id: 'bob', email: 'bob@example.test' });
  assert.equal(saved.length, 0); assert.ok(raw);
  await api.savePendingStreet({ id: 'alice', email: 'alice@example.test' });
  assert.equal(saved.length, 1); assert.equal(saved[0].id, 'alice'); assert.equal(saved[0].street, 'Private Street'); assert.equal(raw, null);
});
test('an expired pending street is discarded rather than saved', async () => {
  let raw = JSON.stringify({ email: 'alice@example.test', street: 'Stale', expiresAt: 1 });
  const api = load('src/services/pending-address.ts', {
    '@react-native-async-storage/async-storage': {}, 'react-native': { Platform: { OS: 'web' } },
    './profiles': { saveStreet: async () => { throw new Error('must not save'); } },
  }, { window: { localStorage: { getItem: () => raw, removeItem: () => { raw = null; } } } });
  await api.savePendingStreet({ id: 'alice', email: 'alice@example.test' }); assert.equal(raw, null);
});
