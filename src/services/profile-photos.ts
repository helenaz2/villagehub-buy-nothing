import { getSupabase } from '@/lib/supabase';
import { readPhoto } from '@/lib/photo-bytes';

const bucket='profile-photos';
export async function getProfilePhoto(id:string):Promise<string>{
 const client=getSupabase();
 const {data,error}=await client.from('profiles').select('avatar_path').eq('id',id).maybeSingle();
 if(error)throw error;
 if(!data?.avatar_path)return '';
 const signed=await client.storage.from(bucket).createSignedUrl(data.avatar_path,3600);
 if(signed.error)throw signed.error;
 return signed.data.signedUrl;
}
export async function saveProfilePhoto(id:string,uri:string):Promise<void>{
 const client=getSupabase();
 const {bytes,mime}=await readPhoto(uri);
 const ext:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
 if(!ext[mime]||!bytes.byteLength||bytes.byteLength>2097152)throw new Error('Choose a JPEG, PNG or WebP photo under 2 MB.');
 const current=await client.from('profiles').select('avatar_path').eq('id',id).single();
 if(current.error)throw current.error;
 const path=`${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext[mime]}`;
 const upload=await client.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false});
 if(upload.error)throw upload.error;
 const saved=await client.from('profiles').update({avatar_path:path}).eq('id',id).select('id').single();
 if(saved.error){await client.storage.from(bucket).remove([path]);throw saved.error;}
 // Cleanup failure must not turn a saved photo into a failed save/retry.
 if(current.data.avatar_path)try{await client.storage.from(bucket).remove([current.data.avatar_path]);}catch{/* The new photo was saved; old-object cleanup can be retried separately. */}
}
