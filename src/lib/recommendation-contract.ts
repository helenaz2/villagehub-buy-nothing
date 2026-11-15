export type RecommendationPlan={action:'search'|'clarify';itemTerms:string[];attributes:string[][];location:'nearby'|'explicit'|'any';city:string|null;neighborhood:string|null};
export type RecommendationCard={id:string;title:string;city:string;neighborhood:string;status:'available';imageUrl:string|null};
export type RecommendationReply={message:string;plan:RecommendationPlan;items:RecommendationCard[]};
export function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid response object.');return value as Record<string,unknown>;}
function text(value:unknown,max:number,min=1):string{if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw new Error('Invalid text field.');return value.trim();}
function terms(value:unknown):string[]{if(!Array.isArray(value)||value.length>6)throw new Error('Invalid search terms.');return [...new Set(value.map(t=>text(t,40)))];}
export function validatePlan(value:unknown):RecommendationPlan{
 const data=record(value),keys=['action','itemTerms','attributes','location','city','neighborhood'];
 if(Object.keys(data).length!==keys.length||Object.keys(data).some(k=>!keys.includes(k)))throw new Error('Invalid search plan fields.');
 if(data.action!=='search'&&data.action!=='clarify')throw new Error('Invalid search action.');
 if(!['nearby','explicit','any'].includes(data.location as string))throw new Error('Invalid location mode.');
 const itemTerms=terms(data.itemTerms);if(data.action==='search'&&!itemTerms.length)throw new Error('An item is required.');
 if(!Array.isArray(data.attributes)||data.attributes.length>3)throw new Error('Invalid attribute groups.');
 const attributes=data.attributes.map(group=>{const result=terms(group);if(!result.length)throw new Error('Empty attribute group.');return result;});
 const city=data.city===null?null:text(data.city,100),neighborhood=data.neighborhood===null?null:text(data.neighborhood,100);
 if(data.location==='explicit'&&!city&&!neighborhood)throw new Error('Explicit location is missing.');
 if(data.location!=='explicit'&&(city||neighborhood))throw new Error('Unexpected explicit location.');
 return {action:data.action,itemTerms,attributes,location:data.location as RecommendationPlan['location'],city,neighborhood};
}
export function validateRecommendationReply(value:unknown):RecommendationReply{
 const data=record(value);if(!Array.isArray(data.items)||data.items.length>8)throw new Error('Invalid listing results.');
 const items=data.items.map(value=>{const item=record(value);const id=text(item.id,36);if(!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)||item.status!=='available')throw new Error('Invalid listing recommendation.');
  const imageUrl=item.imageUrl===null?null:text(item.imageUrl,4096);if(imageUrl&&!/^https?:\/\//.test(imageUrl))throw new Error('Invalid listing photo.');
  return {id,title:text(item.title,120),city:text(item.city,100),neighborhood:text(item.neighborhood,100),status:'available' as const,imageUrl};});
 if(new Set(items.map(item=>item.id)).size!==items.length)throw new Error('Duplicate listing results.');
 return {message:text(data.message,500),plan:validatePlan(data.plan),items};
}
