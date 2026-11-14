import {Capacitor,registerPlugin} from '@capacitor/core';
import {firebaseEnabled} from './backend';
const vault=registerPlugin<{get(input:{key:string}):Promise<{value?:string}>;set(input:{key:string;value:string}):Promise<void>}>('SessionVault');
const native=()=>!firebaseEnabled&&Capacitor.getPlatform()==='android';
let value='',activeToken='',queue:Promise<void>=Promise.resolve();
export async function restoreCredentials():Promise<void>{
 if(!native())return;
 const saved=await vault.get({key:'credentials'});value=saved.value||'';
 if(localStorage.getItem('rlq_signed_out')==='1'){const next=read();next.token='';delete next.user;delete next.familyId;value=JSON.stringify(next);await vault.set({key:'credentials',value});}
 const legacy=localStorage.getItem('real_life_quest_api_token');
 if(!value&&legacy&&localStorage.getItem('rlq_signed_out')!=='1'){let user;try{user=JSON.parse(localStorage.getItem('real_life_quest_api_user')||'null')}catch{}value=JSON.stringify({token:legacy,user,familyId:localStorage.getItem('real_life_quest_api_family'),devices:{}});await vault.set({key:'credentials',value});}
 localStorage.removeItem('real_life_quest_api_token');
 localStorage.removeItem('real_life_quest_api_user');localStorage.removeItem('real_life_quest_api_family');
 activeToken=read().token||'';
}
type StoredUser={id:string;displayName:string;role:'parent'|'child';age?:number|null};
type Credentials={token?:string;user?:StoredUser;familyId?:string;devices?:Record<string,{token:string;name:string}>};
function read():Credentials{try{return JSON.parse(native()?value:localStorage.getItem('rlq_credentials')||'{}')||{}}catch{return {}}}
async function write(next:Credentials){const encoded=JSON.stringify(next);if(native()){await vault.set({key:'credentials',value:encoded});value=encoded;}else localStorage.setItem('rlq_credentials',encoded);}
export function sessionToken():string{return native()?activeToken:read().token??localStorage.getItem('real_life_quest_api_token')??'';}
export function sessionUser():StoredUser|null{const user=read().user;if(user&&typeof user.id==='string'&&['parent','child'].includes(user.role))return user;if(native())return null;try{return JSON.parse(localStorage.getItem('real_life_quest_api_user')||'null')}catch{return null}}
export function pairedChild(id?:string):{id:string;token:string;name:string}|undefined{const devices=read().devices||{};const chosen=id&&devices[id]?id:Object.keys(devices)[0];return chosen?{id:chosen,...devices[chosen]}:undefined;}
export async function persistCredentials(token:string,child?:{id:string;token:string;name:string},session?:{user:StoredUser;familyId?:string}):Promise<void>{
 const operation=queue.catch(()=>{}).then(async()=>{const next=read();next.token=token;if(session){next.user=session.user;next.familyId=session.familyId;}if(!token){delete next.user;delete next.familyId;}if(child)next.devices={[child.id]:{token:child.token,name:child.name}};await write(next);activeToken=token;if(token)localStorage.removeItem('rlq_signed_out');localStorage.removeItem('real_life_quest_api_token');});queue=operation;await operation;
}
export function clearCredentials():Promise<void>{activeToken='';localStorage.setItem('rlq_signed_out','1');localStorage.removeItem('real_life_quest_api_token');if(!native()){const next=read();next.token='';delete next.user;delete next.familyId;localStorage.setItem('rlq_credentials',JSON.stringify(next));}return persistCredentials('');}
