// A transactional test double for business/HTTP tests. It is NOT the Firestore emulator
// and does not validate Google token signatures, server SDK protocols or indexes.
import assert from 'node:assert/strict';
import {FieldValue} from 'firebase-admin/firestore';
import {randomUUID} from 'node:crypto';
const copy=value=>structuredClone(value);
export function memoryServices(){
 const records=new Map(),accounts=new Map(),tokens=new Map(),files=new Map();let tail=Promise.resolve();
 class Query{
  constructor(path,filters=[],orders=[],maximum=Infinity,cursor=null){Object.assign(this,{path,filters,orders,maximum,cursor});}
  where(field,op,value){return new Query(this.path,[...this.filters,[field,op,value]],this.orders,this.maximum,this.cursor);}
  orderBy(field,dir='asc'){return new Query(this.path,this.filters,[...this.orders,[field,dir]],this.maximum,this.cursor);}
  limit(n){return new Query(this.path,this.filters,this.orders,n,this.cursor);}
  startAfter(...values){return new Query(this.path,this.filters,this.orders,this.maximum,values);}
  doc(key=randomUUID()){return new Ref(this.path+'/'+key);}
  count(){return {get:async()=>{const count=(await this.get()).size;return {data:()=>({count})};}};}
  async get(){let docs=[...records].filter(([key])=>key.startsWith(this.path+'/')&&key.split('/').length===this.path.split('/').length+1).map(([key])=>snapshot(new Ref(key)));docs=docs.filter(d=>this.filters.every(([field,op,value])=>{const actual=d.data()[field];if(op==='==')return actual===value;if(op==='<')return actual<value;if(op==='in')return value.includes(actual);if(op==='array-contains')return actual?.includes(value);throw Error('Unsupported fake query '+op);}));const val=(d,f)=>f==='__name__'?d.id:d.data()[f];const compare=(a,b)=>{for(const [field,dir]of this.orders){const result=a(field)<b(field)?-1:a(field)>b(field)?1:0;if(result)return dir==='desc'?-result:result;}return 0;};docs.sort((a,b)=>compare(f=>val(a,f),f=>val(b,f)));if(this.cursor)docs=docs.filter(d=>compare(f=>val(d,f),f=>this.cursor[this.orders.findIndex(([field])=>field===f)])>0);docs=docs.slice(0,this.maximum);return {docs,size:docs.length,empty:!docs.length};}
 }
 class Ref{
  constructor(path){this.path=path;this.id=path.split('/').at(-1);}
  collection(name){return new Query(this.path+'/'+name);}
  async get(){return snapshot(this);}
  async set(data){records.set(this.path,copy(data));}
  async create(data){if(records.has(this.path))throw Object.assign(Error('Already exists'),{code:6});await this.set(data);}
  async update(patch){assert(records.has(this.path),'Cannot update missing '+this.path);const data=copy(records.get(this.path));for(const[key,value]of Object.entries(patch)){if(value?.isEqual?.(FieldValue.delete()))delete data[key];else if(value?.constructor?.name==='ArrayUnionTransform')data[key]=[...new Set([...(data[key]||[]),...value.elements])];else data[key]=copy(value);}records.set(this.path,data);}
  async delete(){records.delete(this.path);}
 }
 const snapshot=ref=>({id:ref.id,ref,exists:records.has(ref.path),data:()=>records.has(ref.path)?copy(records.get(ref.path)):undefined});
 function writer(){const writes=[];return {get:async ref=>{assert.equal(writes.length,0,'Firestore transactions must read before writing');return ref.get();},set:(r,d)=>writes.push(()=>r.set(d)),create:(r,d)=>writes.push(()=>r.create(d)),update:(r,d)=>writes.push(()=>r.update(d)),delete:r=>writes.push(()=>r.delete()),commit:async()=>{for(const write of writes)await write();}};}
 const db={collection:name=>new Query(name),batch:writer,runTransaction:fn=>{const result=tail.then(async()=>{const transaction=writer();const result=await fn(transaction);await transaction.commit();return result;});tail=result.catch(()=>{});return result;},recursiveDelete:async ref=>{for(const key of records.keys())if(key===ref.path||key.startsWith(ref.path+'/'))records.delete(key);}};
 const auth={createUser:async data=>{assert(!accounts.has(data.uid));accounts.set(data.uid,{...data,providerData:[],email: data.email||''});return accounts.get(data.uid);},getUser:async uid=>{if(!accounts.has(uid))throw Object.assign(Error('No auth user'),{code:'auth/user-not-found'});return accounts.get(uid);},verifyIdToken:async token=>{const claims=tokens.get(token);if(!claims||!accounts.has(claims.uid))throw Error('Invalid token');return claims;},createCustomToken:async uid=>'custom:'+uid,deleteUser:async uid=>{accounts.delete(uid);},revokeRefreshTokens:async uid=>{for(const[key,value]of tokens)if(value.uid===uid)tokens.delete(key);}};
 function token(uid,provider='password'){const value=randomUUID();tokens.set(value,{uid,email:accounts.get(uid)?.email,email_verified:provider==='google.com',auth_time:Math.floor(Date.now()/1000),firebase:{sign_in_provider:provider}});return value;}
 const sign=async email=>{const uid=randomUUID();await auth.createUser({uid,email});return {idToken:token(uid),localId:uid};};
 auth.getUserByEmail=async email=>{const user=[...accounts.values()].find(u=>u.email===email);if(!user)throw Error('Unknown email');return user;};
 const childToken=async value=>token(value.slice('custom:'.length),'custom');
 const bucket={file:path=>({save:async bytes=>files.set(path,bytes),download:async()=>{assert(files.has(path),'Missing private proof');return [files.get(path)];},delete:async()=>files.delete(path)}),deleteFiles:async({prefix})=>{for(const key of files.keys())if(key.startsWith(prefix))files.delete(key);},getFiles:async({prefix})=>[[...files.keys()].filter(key=>key.startsWith(prefix))]};
 const login=async email=>{const user=await auth.getUserByEmail(email);return {idToken:token(user.uid),localId:user.uid};};
 return {db,auth,bucket,sign,login,childToken};
}
