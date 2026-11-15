import { authenticateAI, cors, object, PublicError, readJson, string, type Config } from './ai-handler.ts';
import { canonicalExternalUrl, classifyFreeReport } from '../../../src/lib/external-discovery.ts';
export function externalSubmissionHandler(config:Config,request:typeof fetch=fetch){
 return async(req:Request):Promise<Response>=>{
  const json=(value:unknown,status=200)=>Response.json(value,{status,headers:cors});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(req.method!=='POST')return json({message:'Method not allowed.'},405);
  try{
   const {userId}=await authenticateAI(req,config,request),body=await readJson(req,8192);
   if(Object.keys(body).some(key=>!['url','title','notes','price','kind','availability','city','neighborhood','notesOwned'].includes(key)))throw new PublicError(400,'Invalid submission fields.');
   const sourceResponse=await request(config.url+'/rest/v1/external_sources?select=slug,allowed_hosts,submission_enabled,status',{headers:{apikey:config.serviceKey??'',Authorization:'Bearer '+config.serviceKey},signal:AbortSignal.timeout(10000)});
   if(!sourceResponse.ok)throw new PublicError(503,'Source configuration unavailable. Please retry.');
   const sources:unknown=await sourceResponse.json();if(!Array.isArray(sources))throw new PublicError(503,'Invalid source configuration.');
   const configured=sources.map(object),craigslist=configured.find(s=>s.slug==='craigslist');
   const hosts=Array.isArray(craigslist?.allowed_hosts)?craigslist.allowed_hosts.filter((h):h is string=>typeof h==='string'):[];
   let link;try{link=canonicalExternalUrl(body.url,hosts);}catch(e){throw new PublicError(400,e instanceof Error?e.message:'Invalid external link.');}
   const source=configured.find(s=>s.slug===link.source);
   if(!source?.submission_enabled||!['link_only','authorized'].includes(source.status as string)||!Array.isArray(source.allowed_hosts)||!source.allowed_hosts.includes(new URL(link.url).hostname))throw new PublicError(400,'This source is unavailable for link submissions.');
   if(body.notesOwned!==true)throw new PublicError(400,'Use your own title and notes, not copied descriptions or images.');
   const title=string(body.title,120),notes=string(body.notes,1000),city=string(body.city,100,0),neighborhood=string(body.neighborhood,100,0);
   if(body.price!==null&&(typeof body.price!=='number'||!Number.isFinite(body.price)||body.price<0||body.price>1000000))throw new PublicError(400,'Enter a valid reported price.');
   if(!['offer','wanted','rental','service'].includes(body.kind as string)||!['unverified','unavailable','expired'].includes(body.availability as string))throw new PublicError(400,'Invalid offer evidence.');
   const evidence={title,notes,price:body.price as number|null,kind:body.kind as 'offer'|'wanted'|'rental'|'service',availability:body.availability as 'unverified'|'unavailable'|'expired'};
   const classification=classifyFreeReport(evidence);
   const response=await request(config.url+'/rest/v1/rpc/receive_external_link',{method:'POST',headers:{apikey:config.serviceKey??'',Authorization:'Bearer '+config.serviceKey,'Content-Type':'application/json'},signal:AbortSignal.timeout(15000),body:JSON.stringify({p_user_id:userId,p_source_slug:link.source,p_external_id:link.externalId,p_url:link.url,p_evidence:{...evidence,city,neighborhood,notesOwned:true,classification:classification.status}})});
   if(!response.ok){let code='';try{code=object(await response.json()).code as string;}catch{/* Do not expose database errors or submitted content. */}throw new PublicError(code==='P0001'?429:code==='23514'?400:503,code==='P0001'?'Daily submission limit reached. Try tomorrow.':code==='23514'?'Check the source URL, city and original notes.':'Unable to save your link. Please retry.');}
   return json(await response.json());
  }catch(e){return json({message:e instanceof PublicError?e.message:'Unable to submit this link. Please retry.'},e instanceof PublicError?e.status:503);}
 };
}
