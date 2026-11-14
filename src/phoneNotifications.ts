import {Capacitor,registerPlugin,type PluginListenerHandle} from '@capacitor/core';
import {api,getApiToken,storedApiUser} from './api';
export type PhoneNotificationStatus={enabled:boolean;permission:boolean;sound:'default'|'gentle'|'bright'|'soft'|'silent'|'custom';customName:string;installationId:string;channelId?:string;needsPermissionPrompt?:boolean;cancelled?:boolean};
export type PhoneNotice={id:string;type:string;title:string;body:string;systemAlert?:boolean};
interface NativeNotifications {
 bind(input:{userId:string;sessionHash:string}):Promise<PhoneNotificationStatus>;
 disconnect():Promise<void>;status():Promise<PhoneNotificationStatus>;enable():Promise<PhoneNotificationStatus>;disable():Promise<PhoneNotificationStatus>;
 token():Promise<PhoneNotificationStatus&{token:string}>;setSound(input:{sound:string}):Promise<PhoneNotificationStatus>;importSound():Promise<PhoneNotificationStatus>;preview():Promise<void>;systemSettings():Promise<void>;
 registered(input:{token:string;sessionHash:string}):Promise<void>;
 opened():Promise<{opened:boolean}>;
 show(notice:PhoneNotice):Promise<{handled:boolean}>;test():Promise<{handled:boolean}>;
 addListener(event:'received',callback:(notice:PhoneNotice)=>void):Promise<PluginListenerHandle>;
 addListener(event:'tokenChanged',callback:(data:{token:string})=>void):Promise<PluginListenerHandle>;
}
export const phoneNotifications=registerPlugin<NativeNotifications>('QuestNotifications');
export const nativeNotificationsAvailable=()=>Capacitor.getPlatform()==='android';
const delivered=new Set<string>();
export const wasPushDelivered=(id:string)=>delivered.has(id);
let binding:Promise<unknown>=Promise.resolve();
let generation=0;
export function disconnectPhoneNotifications():Promise<void>{generation++;binding=binding.catch(()=>{}).then(()=>nativeNotificationsAvailable()?phoneNotifications.disconnect():undefined);return binding.then(()=>{});}
export function bindPhoneNotifications(userId:string,token:string):Promise<PhoneNotificationStatus|undefined>{
 const mine=++generation;
 binding=binding.catch(()=>{}).then(async()=>{
  if(!nativeNotificationsAvailable()||mine!==generation)return;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
  if(mine!==generation)return;
  const sessionHash=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
  return phoneNotifications.bind({userId,sessionHash});
 });
 return binding as Promise<PhoneNotificationStatus|undefined>;
}
export async function registerPhoneNotifications(){
 const owner=storedApiUser()?.id,session=getApiToken();if(!owner||!session||!nativeNotificationsAvailable())return;
 const status=await phoneNotifications.status();if(!status.enabled||!status.permission)return;
 const registered=await phoneNotifications.token();
 if(getApiToken()!==session||storedApiUser()?.id!==owner)return;
 await api.registerPushDevice({installationId:registered.installationId,token:registered.token,...(registered.channelId?{channelId:registered.channelId}:{})});
 if(getApiToken()!==session||storedApiUser()?.id!==owner)return;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(session));
 await phoneNotifications.registered({token:registered.token,sessionHash:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')});
}
export async function listenPhoneNotifications(onNotice:(notice:PhoneNotice)=>void){
 if(!nativeNotificationsAvailable())return ()=>{};
 const received=await phoneNotifications.addListener('received',notice=>{
  if(delivered.has(notice.id))return;delivered.add(notice.id);if(delivered.size>200)delivered.delete(delivered.values().next().value!);
  onNotice(notice);
 });
 const refreshed=await phoneNotifications.addListener('tokenChanged',()=>{void registerPhoneNotifications().catch(()=>{});});
 return ()=>{void received.remove();void refreshed.remove();};
}
export function playPhoneNotification(enabled:boolean){
 if(!enabled||document.hidden)return;
 if(nativeNotificationsAvailable()){void phoneNotifications.preview().catch(()=>{});return;}
 // Web preview uses the same gentle envelope; Android channel audio is independent of in-app sound.
 try{const ctx=new AudioContext();[660,880].forEach((frequency,index)=>{const start=ctx.currentTime+index*.16,o=ctx.createOscillator(),gain=ctx.createGain();o.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.05,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+.5);o.connect(gain);gain.connect(ctx.destination);o.start(start);o.stop(start+.52);});setTimeout(()=>void ctx.close(),1000);}catch{/* Visible notifications still work. */}
}
export async function showPhoneNotification(notice:PhoneNotice,sound:boolean){
 if(document.hidden)return;
 if(nativeNotificationsAvailable()){
  try{const result=await phoneNotifications.show(notice);if(result.handled)return;}catch{/* A visible in-app alert still works when native posting is unavailable. */}
 }
 playPhoneNotification(sound);
}
