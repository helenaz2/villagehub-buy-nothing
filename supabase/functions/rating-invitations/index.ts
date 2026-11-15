import { ratingWorker } from '../_shared/rating-worker.ts';
Deno.serve(ratingWorker({workerKey:Deno.env.get('RATING_WORKER_KEY'),url:Deno.env.get('SUPABASE_URL'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}));
