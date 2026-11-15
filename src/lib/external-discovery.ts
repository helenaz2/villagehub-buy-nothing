// This module never fetches marketplace pages. Collection and republication are
// separate permissions; a submitted URL is not evidence of either permission.
export type ExternalSourceKey='facebook_marketplace'|'craigslist'|'freecycle'|'buy_nothing';
export type ExternalAdapter={key:ExternalSourceKey;name:string;submission:boolean;automated:false;reason:string;termsUrl:string};
export const externalAdapters:ExternalAdapter[]=[
 {key:'facebook_marketplace',name:'Facebook Marketplace',submission:true,automated:false,reason:'No verified collection or republication authorization. Marketplace item links only; groups are not accepted.',termsUrl:'https://www.facebook.com/legal/automated_data_collection_terms'},
 {key:'craigslist',name:'Craigslist',submission:true,automated:false,reason:'Separate authorization is required for collection and reuse. No page fetching or content copying.',termsUrl:'https://www.craigslist.org/about/terms.of.use/en'},
 {key:'freecycle',name:'Freecycle',submission:true,automated:false,reason:'Terms restrict automated downloading and redistribution. Link-only intake; no collection connector.',termsUrl:'https://www.freecycle.org/pages/TOS'},
 {key:'buy_nothing',name:'Buy Nothing communities',submission:false,automated:false,reason:'No verified authorized feed or public item-link format. Private group content is not accepted.',termsUrl:'https://buynothingproject.org/terms'},
];
export const BAY_AREA_CITIES=['Berkeley','Oakland','San Francisco','Alameda','Albany','Emeryville','Richmond','El Cerrito','San Leandro','Daly City','South San Francisco','San Pablo','Piedmont'];
export function canonicalExternalUrl(value:unknown,craigslistHosts:string[]=['sfbay.craigslist.org']):{source:ExternalSourceKey;externalId:string;url:string}{
 if(typeof value!=='string'||value.length>2048)throw new Error('Enter a valid original listing URL.');
 let url:URL;try{url=new URL(value.trim());}catch{throw new Error('Enter a valid original listing URL.');}
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw new Error('Use an HTTPS listing URL without credentials or a custom port.');
 const host=url.hostname.toLowerCase(),path=url.pathname.replace(/\/+$/,'');
 let id:string|undefined;
 if(['facebook.com','www.facebook.com','m.facebook.com'].includes(host)){
  id=/^\/marketplace\/item\/(\d{5,30})$/.exec(path)?.[1];
  if(!id)throw new Error('Use a Marketplace item URL. Facebook groups and login links are not supported.');
  return {source:'facebook_marketplace',externalId:id,url:'https://www.facebook.com/marketplace/item/'+id};
 }
 if(craigslistHosts.includes(host)&&/^[a-z0-9-]+\.craigslist\.org$/.test(host)){
  id=/^\/(?:[a-z]{3}\/)?zip\/d\/[a-z0-9-]+\/(\d{5,20})\.html$/.exec(path)?.[1];
  if(!id)throw new Error('Use a Bay Area Craigslist free-stuff item URL.');
  return {source:'craigslist',externalId:id,url:'https://'+host+path};
 }
 if(['www.freecycle.org','freecycle.org'].includes(host)){
  id=/^\/posts\/(\d{1,20})$/.exec(path)?.[1];if(!id)throw new Error('Use a Freecycle post URL.');
  return {source:'freecycle',externalId:id,url:'https://www.freecycle.org/posts/'+id};
 }
 throw new Error('This source is unavailable. No external page was fetched.');
}
export type FreeEvidence={title:string;notes:string;price:number|null;kind:'offer'|'wanted'|'rental'|'service';availability:'unverified'|'unavailable'|'expired'};
export function classifyFreeReport(value:FreeEvidence):{status:'reported_free'|'rejected'|'needs_review';warnings:string[]}{
 const text=(value.title+' '+value.notes).toLowerCase(),warnings:string[]=[];
 if(value.kind!=='offer')return {status:'rejected',warnings:['Only offers of physical items are eligible.']};
 if(value.availability!=='unverified')return {status:'rejected',warnings:['The submission reports an expired or unavailable item.']};
 if(value.price!==null&&(!Number.isFinite(value.price)||value.price!==0))return {status:'rejected',warnings:['The price must be explicitly zero.']};
 const nonzeroMoney=[...text.matchAll(/[$£€]\s*(\d+(?:\.\d+)?)/g)].some(match=>Number(match[1])>0);
 if(/\b(wanted|iso|looking for|for rent|rental|free shipping|free with purchase|donation required|delivery fee|deposit|starting at|obo|make an offer|sold|claimed|no longer available)\b/i.test(text)||nonzeroMoney)return {status:'rejected',warnings:['The text conflicts with an unconditionally free, available item offer.']};
 if(value.price===null||!/(\bfree\b|\bno charge\b|\bgiving away\b|\bzero cost\b|\$0(?:\D|$))/i.test(text))return {status:'needs_review',warnings:['An explicit zero price and free-item statement are required.']};
 warnings.push('User-reported free offer; the marketplace has not been fetched or verified.','Publication rights and current availability require human review.');
 return {status:'reported_free',warnings};
}
export function reservedSystemIdentity(username:string,displayName:string):boolean{
 const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
 const reserved=['villagehubbuynothing','villagehubofficial','villagehubadmin'];return reserved.includes(normalize(username))||reserved.includes(normalize(displayName));
}
