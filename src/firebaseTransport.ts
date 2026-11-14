import {initializeApp} from 'firebase/app';
import {connectAuthEmulator,createUserWithEmailAndPassword,EmailAuthProvider,getAuth,GoogleAuthProvider,linkWithCredential,reauthenticateWithCredential,sendPasswordResetEmail,signInWithCredential,signInWithCustomToken,signInWithEmailAndPassword,signOut} from 'firebase/auth';
import {firebaseApiBase,sessionPrefix} from './backend';
const env=(import.meta as ImportMeta&{env?:Record<string,string>}).env||{};
const required=['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID','VITE_FIREBASE_STORAGE_BUCKET','VITE_FIREBASE_API_BASE_URL'];
const missing=required.some(key=>!env[key]||env[key].includes('REPLACE'));
let auth:ReturnType<typeof getAuth>|undefined;
function runtime(){if(missing)throw new Error('Firebase setup is not complete yet. Add the new project configuration before signing in.');if(!auth){auth=getAuth(initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,projectId:env.VITE_FIREBASE_PROJECT_ID,appId:env.VITE_FIREBASE_APP_ID,storageBucket:env.VITE_FIREBASE_STORAGE_BUCKET}));if(env.VITE_FIREBASE_EMULATORS==='true')connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});}return auth;}
function problem(error:unknown):never{const code=(error as {code?:string}).code||'';if(code==='auth/account-exists-with-different-credential')throw Object.assign(new Error('Connect your existing account using its password.'),{status:409});if(['auth/invalid-credential','auth/wrong-password','auth/invalid-login-credentials','auth/user-not-found'].includes(code))throw Object.assign(new Error('Email or password is incorrect.'),{status:401});if(code==='auth/email-already-in-use')throw new Error('This email already has an account. Please sign in.');if(code==='auth/popup-closed-by-user')throw Object.assign(new Error('Sign-in cancelled.'),{code:'CANCELLED'});if(code==='auth/too-many-requests')throw new Error('Too many attempts. Please wait and try again.');if(code==='auth/network-request-failed')throw new Error('Check your internet connection and try again.');throw error;}
async function http<T>(path:string,method:string,body?:unknown):Promise<T>{const a=runtime();await a.authStateReady();const token=await a.currentUser?.getIdToken();const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);try{const response=await fetch(firebaseApiBase.replace(/\/$/,'')+path,{method,headers:{Accept:'application/json','Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'Please try again.'),{status:response.status});return data as T;}catch(error){if(controller.signal.aborted)throw new Error('The connection timed out. Please try again.');if(error instanceof TypeError)throw new Error('Could not connect. Check your internet and try again.');throw error;}finally{clearTimeout(timer);}}
async function grant(password:string){const a=runtime();await a.authStateReady();if(!a.currentUser?.email)throw new Error('Sign in to your parent account first.');await reauthenticateWithCredential(a.currentUser,EmailAuthProvider.credential(a.currentUser.email,password));await a.currentUser.getIdToken(true);return http<{reauthToken:string}>('/account/reauth','POST',{});}
async function parentSession(displayName?:string,code?:string,ref?:string){return http('/auth/session','POST',{displayName,code,ref});}
export async function firebaseSignOut(){if(auth)await signOut(auth);}
export async function firebaseRequest<T>(path:string,init:RequestInit={}):Promise<T>{try{
 const method=init.method||'GET';const input=init.body?JSON.parse(String(init.body)):{};
 if(path==='/auth/google/challenge')return {nonce:crypto.randomUUID()+crypto.randomUUID()} as T;
 const a=runtime();await a.authStateReady();
 if(path==='/auth/google'){
  const credential=GoogleAuthProvider.credential(input.idToken);
  if(input.password){const payload=JSON.parse(atob(input.idToken.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));const signed=await signInWithEmailAndPassword(a,String(payload.email),input.password);await linkWithCredential(signed.user,credential);}
  else await signInWithCredential(a,credential);
  return await parentSession() as T;
 }
 if(path==='/account/reauth-google'){if(!a.currentUser)throw new Error('Sign in again.');await reauthenticateWithCredential(a.currentUser,GoogleAuthProvider.credential(input.idToken));await a.currentUser.getIdToken(true);return await http(path,'POST',{}) as T;}
 if(path==='/auth/password/request'){try{await sendPasswordResetEmail(a,input.email);}catch(error){if((error as {code?:string}).code!=='auth/user-not-found')throw error;}return {ok:true,message:'If a parent account uses that email, a reset link will arrive shortly. Check your spam folder too.'} as T;}
 if(path==='/auth/register'||path==='/auth/register-coparent'){
  try{await createUserWithEmailAndPassword(a,input.email,input.password);}catch(error){if(path==='/auth/register-coparent'&&(error as {code?:string}).code==='auth/email-already-in-use')await signInWithEmailAndPassword(a,input.email,input.password);else throw error;}
  return await parentSession(input.displayName,path==='/auth/register-coparent'?input.code:undefined,input.ref) as T;
 }
 if(path==='/auth/login'){await signInWithEmailAndPassword(a,input.email,input.password);return await parentSession() as T;}
 if(path==='/auth/child-login'||path==='/auth/register-child'){const result=await http<{customToken:string}>(path,'POST',input);await signInWithCustomToken(a,result.customToken);const {customToken,...safe}=result;return safe as T;}
 if(['/account/password','/account/delete-self','/family/delete-child','/safety/erase-child','/safety/erase-family'].includes(path)){
  if(!input.reauthToken){const proof=await grant(input.currentPassword||input.password||'');input.reauthToken=proof.reauthToken;}delete input.currentPassword;delete input.password;
  const result=await http<T>(path,method,input);
  if(path==='/account/password'){await signOut(a);for(const suffix of ['token','user','family'])localStorage.removeItem(sessionPrefix+suffix);localStorage.removeItem('rlq_started');location.reload();}
  return result;
 }
 return await http<T>(path,method,init.body?input:undefined);
 }catch(error){return problem(error);}}
