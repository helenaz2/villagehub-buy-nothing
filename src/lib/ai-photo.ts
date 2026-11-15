import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
// Keep originals for the listing. Only a resized, re-encoded cover is sent to AI.
export async function prepareAIPhoto(uri:string):Promise<string>{
 const source=await ImageManipulator.manipulate(uri).renderAsync();
 const image=Math.max(source.width,source.height)>1024
  ?await ImageManipulator.manipulate(source).resize(source.width>=source.height?{width:1024}:{height:1024}).renderAsync():source;
 const result=await image.saveAsync({format:SaveFormat.JPEG,compress:0.75,base64:true});
 if(!result.base64 || result.base64.length>2796204)throw new Error('This photo is too large for AI. Choose a smaller cover photo.');
 return 'data:image/jpeg;base64,'+result.base64;
}
