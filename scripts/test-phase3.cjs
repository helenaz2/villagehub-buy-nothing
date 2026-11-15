const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function service(client){const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/messaging.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:m.exports,Date,require:id=>id==='@/lib/backend-config'?{backendConfig:{ratings:false}}:{getSupabase:()=>client}});return m.exports;}
const row={id:'c',listing_id:null,listing_title:'Deleted listing',host_id:'host',requester_id:'requester',last_message_at:'2026-11-14T12:00:00Z',last_sequence:5,last_sender_id:'requester',preview:'Hello'};
test('restored thread retains counterpart/title after listing deletion and own preferences',()=>{const api=service({});const c=api.mapThread(row,{pinned:true,hidden:false,last_read_sequence:4,unread_override:null},'host');assert.equal(c.participantId,'requester');assert.equal(c.title,'Deleted listing');assert.equal(c.unread,true);assert.equal(c.pinned,true);assert.equal(api.mapThread(row,{last_read_sequence:4,unread_override:false},'host').unread,false);});
test('message RPC keeps retry identity and propagates backend authorization failure',async()=>{let args;const api=service({rpc:async(name,payload)=>{args={name,payload};return {error:new Error('Denied')};}});await assert.rejects(api.sendMessage('c','Hello','stable-retry-key'),/Denied/);assert.equal(args.payload.p_client_key,'stable-retry-key');assert.equal(args.name,'send_message');assert.equal('sender_id' in args.payload,false);});
test('read RPC sends only the observed sequence rather than current wall clock',async()=>{let sent;const api=service({rpc:async(name,args)=>{sent=args;return {error:null};}});await api.markRead('c',5);assert.equal(sent.p_sequence,5);assert.equal(Object.keys(sent).length,2);});
test('Realtime readiness waits for backend listener, then cleans up the exact channel',()=>{
 const handlers={},statuses=[];let socketStatus,removed;
 const channel={on:(event,filter,cb)=>{handlers[event]=cb;return channel;},subscribe:cb=>{socketStatus=cb;return channel;}};
 const api=service({channel:()=>channel,removeChannel:c=>{removed=c;}});
 const cleanup=api.subscribeInbox('host',()=>{},status=>statuses.push(status));
 socketStatus('SUBSCRIBED');assert.equal(statuses.length,0);
 handlers.system({extension:'postgres_changes',status:'ok'});assert.equal(statuses[0],'SUBSCRIBED');
 socketStatus('CHANNEL_ERROR');assert.equal(statuses[1],'CHANNEL_ERROR');cleanup();assert.equal(removed,channel);
});
