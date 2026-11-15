import { recommendationHandler } from '../_shared/recommendation-handler.ts';
Deno.serve(recommendationHandler({url:Deno.env.get('SUPABASE_URL'),anonKey:Deno.env.get('SUPABASE_ANON_KEY'),serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),openAIKey:Deno.env.get('OPENAI_API_KEY'),model:Deno.env.get('OPENAI_MODEL')}));
