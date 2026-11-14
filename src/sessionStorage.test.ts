import {beforeEach,describe,it,expect,vi} from 'vitest';
const vault=vi.hoisted(()=>({value:undefined as string|undefined,fail:false}));
vi.mock('@capacitor/core',()=>({Capacitor:{getPlatform:()=> 'android'},registerPlugin:()=>({get:async()=>({value:vault.value}),set:async({value}:{value:string})=>{if(vault.fail)throw Error('Storage full');vault.value=value;}})}));
const values:Record<string,string>={};
const storage={getItem:(key:string)=>values[key]??null,setItem:(key:string,value:string)=>{values[key]=value;},removeItem:(key:string)=>{delete values[key];},clear:()=>{for(const key of Object.keys(values))delete values[key];}};
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
beforeEach(()=>{vi.resetModules();storage.clear();vault.value=undefined;vault.fail=false;});
const parent={id:'parent-a',displayName:'Parent A',role:'parent' as const};
describe('native persisted session boundary',()=>{
 it('migrates the existing session before removing the plaintext legacy token',async()=>{
  storage.setItem('real_life_quest_api_token','old-token');storage.setItem('real_life_quest_api_user',JSON.stringify(parent));const session=await import('./sessionStorage');await session.restoreCredentials();expect(session.sessionToken()).toBe('old-token');expect(session.sessionUser()).toEqual(parent);expect(storage.getItem('real_life_quest_api_token')).toBeNull();
 });
 it('leaves legacy sign-in intact if secure migration fails',async()=>{
  storage.setItem('real_life_quest_api_token','old-token');vault.fail=true;const session=await import('./sessionStorage');await expect(session.restoreCredentials()).rejects.toThrow('Storage full');expect(storage.getItem('real_life_quest_api_token')).toBe('old-token');
 });
 it('keeps token and user together when a replacement secure write fails',async()=>{
  const session=await import('./sessionStorage');await session.restoreCredentials();await session.persistCredentials('a',undefined,{user:parent});vault.fail=true;await expect(session.persistCredentials('b',undefined,{user:{...parent,id:'parent-b'}})).rejects.toThrow();expect(session.sessionToken()).toBe('a');expect(session.sessionUser()?.id).toBe('parent-a');
 });
 it('never revives a logged-out session and preserves the child pairing',async()=>{
  const session=await import('./sessionStorage');await session.restoreCredentials();await session.persistCredentials('a',{id:'child-a',name:'Umar',token:'device-a'},{user:parent});await session.clearCredentials();expect(session.sessionToken()).toBe('');expect(session.pairedChild()?.token).toBe('device-a');
  vault.value=JSON.stringify({token:'stale',user:parent,devices:{'child-a':{token:'device-a',name:'Umar'}}});const reboot=await import('./sessionStorage');await reboot.restoreCredentials();expect(reboot.sessionToken()).toBe('');expect(reboot.sessionUser()).toBeNull();expect(reboot.pairedChild()?.id).toBe('child-a');
 });
 it('switches device binding without erasing the old owner photo draft',async()=>{
  const session=await import('./sessionStorage');await session.restoreCredentials();storage.setItem('rlq_proof_draft_child-a_task','unsent');await session.persistCredentials('a',{id:'child-a',name:'Umar',token:'device-a'},{user:parent});await session.persistCredentials('b',{id:'child-b',name:'Umar',token:'device-b'},{user:{...parent,id:'parent-b'}});expect(session.pairedChild()?.id).toBe('child-b');expect(storage.getItem('rlq_proof_draft_child-a_task')).toBe('unsent');
 });
});
