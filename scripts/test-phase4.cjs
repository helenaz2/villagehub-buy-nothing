const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(path,deps={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,require:id=>deps[id],Date,Request,Response,TextEncoder,Uint8Array,crypto:globalThis.crypto,fetch});return m.exports;}
test('revoked or stale rating invitation cannot appear in the current conversation',()=>{
 const {applyRatingState}=load('src/services/ratings.ts',{'@/lib/supabase':{}});
 const thread={id:'c',lastSequence:3,messages:[]};
 assert.equal(applyRatingState(thread,'me',[{conversation_id:'c',sequence:2,available_at:'2026-11-14T12:00:00Z'}],[]).ratingAvailableAt,undefined);
 assert.equal(applyRatingState(thread,'me',[{conversation_id:'c',sequence:3,available_at:null}],[]).ratingAvailableAt,undefined);
 assert.ok(applyRatingState(thread,'me',[{conversation_id:'c',sequence:3,available_at:'2026-11-14T12:00:00Z'}],[]).ratingAvailableAt);
});
test('worker rejects public or missing credentials before making a privileged request',async()=>{
 const {ratingWorker}=load('supabase/functions/_shared/rating-worker.ts');let calls=0;
 const handler=ratingWorker({workerKey:'server-only-key',url:'https://example.supabase.co',serviceKey:'server-test-key'},async()=>{calls++;return Response.json(0);});
 assert.equal((await handler(new Request('https://worker',{method:'POST'}))).status,401);
 assert.equal((await handler(new Request('https://worker',{method:'POST',headers:{'x-worker-key':'public-publishable-key'}}))).status,401);
 assert.equal(calls,0);
 assert.equal((await ratingWorker({})(new Request('https://worker',{method:'POST'}))).status,503);
});
test('worker sends server credentials only to the RPC and sanitizes failures',async()=>{
 const {ratingWorker}=load('supabase/functions/_shared/rating-worker.ts');let sent;
 const req=()=>new Request('https://worker',{method:'POST',headers:{'x-worker-key':'server-only-key'}});
 const config={workerKey:'server-only-key',url:'https://example.supabase.co',serviceKey:'secret-never-return'};
 const response=await ratingWorker(config,async(url,options)=>{sent={url,options};return Response.json(2);})(req());
 assert.equal((await response.json()).processed,2);assert.equal(sent.options.headers.Authorization,'Bearer secret-never-return');assert.ok(sent.url.endsWith('/rest/v1/rpc/process_rating_jobs'));
 const failure=await ratingWorker(config,async()=>new Response('secret-never-return',{status:500}))(req());assert.equal(failure.status,502);assert.equal((await failure.text()).includes('secret-never-return'),false);
});
