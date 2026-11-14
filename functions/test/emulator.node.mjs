import {runScenario} from './scenario.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {createService} from '../src/service.js';
test('Firebase Auth + Firestore + Storage family flows', {skip:!process.env.FIRESTORE_EMULATOR_HOST,timeout:180000},async()=>{
 process.env.PUBLIC_APP_URL='https://demo-rlq.web.app/real-life-quest';process.env.MODERATION_ADMIN_EMAILS='';
 const projectId='demo-rlq';const app=initializeApp({projectId,storageBucket:projectId+'.appspot.com'},'release-test');const db=getFirestore(app),auth=getAuth(app),bucket=getStorage(app).bucket();
 const service=createService({db,auth,bucket});const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 const authHost='http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1';
 async function sign(email,password='Password-123'){const r=await fetch(authHost+'/accounts:signUp?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});const data=await r.json();assert(r.ok,JSON.stringify(data));return data;}
 async function login(email,password='Password-123'){const r=await fetch(authHost+'/accounts:signInWithPassword?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});const data=await r.json();assert(r.ok,JSON.stringify(data));return data;}
 async function childToken(customToken){const r=await fetch(authHost+'/accounts:signInWithCustomToken?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:customToken,returnSecureToken:true})});const data=await r.json();assert(r.ok,JSON.stringify(data));return data.idToken;}
 async function call(path,token,body,expected=200,method=body?'POST':'GET'){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,expected,path+': '+JSON.stringify(data));return data;}
 try{
  await runScenario({sign,login,call,childToken,bucket,base,db});
  console.log('Verified real emulator Auth tokens, family isolation, invitation race, exactly-once XP/rewards, Storage proof authorization and deletion.');
 }finally{await new Promise(r=>server.close(r));await db.terminate();await deleteApp(app);}
});
