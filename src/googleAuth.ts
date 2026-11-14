import {Capacitor, registerPlugin} from '@capacitor/core';

const env=(import.meta as ImportMeta&{env?:Record<string,string>}).env||{};
export const GOOGLE_WEB_CLIENT_ID = env.VITE_GOOGLE_WEB_CLIENT_ID||(env.VITE_BACKEND_PROVIDER==='firebase'?'':'544468144624-smc0hnb1fp88q1gjddlptovt4fogg4m7.apps.googleusercontent.com');
const nativeGoogle = registerPlugin<{signIn(options:{clientId:string;nonce:string}):Promise<{idToken:string}>}>('ParentGoogleAuth');

export async function googleIdToken(nonce:string):Promise<string> {
  if(!GOOGLE_WEB_CLIENT_ID||GOOGLE_WEB_CLIENT_ID.includes('REPLACE'))throw new Error('Add the new Firebase project’s Google Web client ID first.');
  if (Capacitor.getPlatform() !== 'android') {
    throw new Error('Open the Android app to continue with Google. You can still use email and password here.');
  }
  const result = await nativeGoogle.signIn({clientId:GOOGLE_WEB_CLIENT_ID,nonce});
  return result.idToken;
}
