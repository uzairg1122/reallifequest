import {describe,it,expect,vi,afterEach} from 'vitest';
import {api,clearApiSession,getApiToken,saveApiSession} from './api';
const store:Record<string,string>={};
const storage={getItem:(key:string)=>store[key]??null,setItem:(key:string,value:string)=>{store[key]=value;},removeItem:(key:string)=>{delete store[key];},clear:()=>{for(const key of Object.keys(store))delete store[key];}};
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
afterEach(()=>{storage.clear();vi.restoreAllMocks();});
describe('shared-hosting API client',()=>{
  it('stores and clears the remote session',async()=>{await saveApiSession({token:'token',user:{id:'u',displayName:'Leo',role:'child'},familyId:'f'});expect(getApiToken()).toBe('token');clearApiSession();expect(getApiToken()).toBe('');});
  it('sends bearer requests and surfaces API errors',async()=>{await saveApiSession({token:'token',user:{id:'u',displayName:'Leo',role:'child'}});const fetchMock=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({tasks:[]}),{status:200,headers:{'Content-Type':'application/json'}}));await api.tasks();expect(fetchMock.mock.calls[0][0]).toContain('/api/tasks');const headers=(fetchMock.mock.calls[0][1] as RequestInit).headers as Headers;expect(headers.get('Authorization')).toBe('Bearer token');fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({error:'No access'}),{status:403}));await expect(api.notifications()).rejects.toThrow('No access');});
});
