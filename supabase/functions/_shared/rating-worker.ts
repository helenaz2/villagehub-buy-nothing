type Config = { workerKey?: string; url?: string; serviceKey?: string };
export function ratingWorker(config: Config, request: typeof fetch = fetch) {
  return async (req: Request): Promise<Response> => {
    if(req.method!=='POST') return new Response('Method not allowed',{status:405});
    if(!config.workerKey || !config.url || !config.serviceKey) return new Response('Worker not configured',{status:503});
    // Fixed-length digests avoid a timing-dependent string comparison.
    const digest=async(value:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
    const [received,expected]=await Promise.all([digest(req.headers.get('x-worker-key')??''),digest(config.workerKey)]);
    let difference=0;for(let n=0;n<expected.length;n++) difference|=received[n]^expected[n];
    if(difference!==0) return new Response('Unauthorized',{status:401});
    try {
      const response=await request(config.url+'/rest/v1/rpc/process_rating_jobs',{method:'POST',headers:{apikey:config.serviceKey,Authorization:'Bearer '+config.serviceKey,'Content-Type':'application/json'},body:'{}'});
      if(!response.ok) return new Response('Rating job processing failed',{status:502});
      const processed:unknown=await response.json();
      if(typeof processed!=='number') return new Response('Unexpected worker result',{status:502});
      return Response.json({processed});
    } catch {return new Response('Rating service unavailable',{status:502});}
  };
}
