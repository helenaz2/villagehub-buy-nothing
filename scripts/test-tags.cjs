const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function service(){
 const calls=[];const chain={};
 for(const method of ['select','in','eq','contains','order','textSearch'])chain[method]=(...args)=>{calls.push([method,...args]);return chain;};
 chain.range=async(...args)=>{calls.push(['range',...args]);return {data:[],error:null};};
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync('src/services/listings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports:module.exports,require:id=>id==='@/lib/supabase'?{getSupabase:()=>({from:()=>chain})}:id==='@/lib/photo-bytes'?{}:(()=>{throw Error('Unexpected dependency');})()});
 return {api:module.exports,calls};
}
test('tag browse uses exact array membership and available-only listings, not text search',async()=>{
 const {api,calls}=service();await api.listListings({tag:'wood'});
 assert.deepEqual(JSON.parse(JSON.stringify(calls.find(c=>c[0]==='contains'))),['contains','tags',['wood']]);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='status'&&c[2]==='available'));
 assert.equal(calls.some(c=>c[0]==='textSearch'),false);
});
test('tag punctuation is passed as a literal array value and pagination is preserved',async()=>{
 const {api,calls}=service();const tag='kids, "arts" & crafts';await api.listListings({tag,offset:20});
 assert.deepEqual(JSON.parse(JSON.stringify(calls.find(c=>c[0]==='contains'))),['contains','tags',[tag]]);
 assert.deepEqual(calls.find(c=>c[0]==='range'),['range',20,39]);
});
test('blank and oversized tags fail without sending a query',async()=>{
 for(const tag of ['   ','a'.repeat(2001)]){const {api,calls}=service();await assert.rejects(api.listListings({tag}),/valid tag/);assert.equal(calls.some(c=>c[0]==='range'),false);}
});
test('normal Explore searches keep their existing behavior without a tag filter',async()=>{
 const {api,calls}=service();await api.listListings({query:'desk'});
 assert.equal(calls.some(c=>c[0]==='contains'),false);
 assert.ok(calls.some(c=>c[0]==='textSearch'&&c[2]==='desk'));
});
