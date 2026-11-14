import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode,command})=>{
 const env=loadEnv(mode,'.','VITE_');const firebase=env.VITE_BACKEND_PROVIDER==='firebase';const api=firebase?env.VITE_FIREBASE_API_BASE_URL||'':env.VITE_ANDROID_API_BASE_URL||env.VITE_API_BASE_URL||'';
 if(command==='build'&&['release','firebase','hostinger'].includes(mode)){
  if(mode==='hostinger'&&(firebase||env.VITE_PARENT_AUTH_MODE!=='google'))throw Error('Hostinger build requires PHP backend and Google-only parent login.');
  if(mode==='firebase'&&!firebase)throw Error('Copy .env.firebase.example to .env.firebase.local and configure the new Firebase project first.');
  const url=new URL(api);
  if(url.protocol!=='https:'||url.username||url.password||api.includes('REPLACE')||/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(url.hostname))throw Error('Release requires a public HTTPS API URL; local/test servers are blocked.');
  if(!env.VITE_PUBLIC_APP_URL?.startsWith('https://'))throw Error('Release requires VITE_PUBLIC_APP_URL.');
  const publicUrl=new URL(env.VITE_PUBLIC_APP_URL);if(publicUrl.username||publicUrl.password||publicUrl.search||publicUrl.hash||!/^\/real-life-quest\/?$/.test(publicUrl.pathname)||publicUrl.hostname.includes('REPLACE'))throw Error('Use the public HTTPS /real-life-quest URL for policy pages and invitations.');
  if(firebase){for(const key of ['VITE_FIREBASE_API_KEY','VITE_FIREBASE_AUTH_DOMAIN','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_STORAGE_BUCKET','VITE_FIREBASE_APP_ID','VITE_GOOGLE_WEB_CLIENT_ID'])if(!env[key]||env[key].includes('REPLACE'))throw Error('Firebase configuration missing: '+key);if(env.VITE_FIREBASE_EMULATORS==='true')throw Error('Emulator mode cannot be published.');}
 }
 return {plugins:[react(),{name:'release-build-metadata',generateBundle(){this.emitFile({type:'asset',fileName:'rlq-build.json',source:JSON.stringify({mode:['firebase','hostinger'].includes(mode)?'release':mode,backend:firebase?'firebase':'php',parentAuth:env.VITE_PARENT_AUTH_MODE||'legacy',apiBaseUrl:api,publicAppUrl:env.VITE_PUBLIC_APP_URL||''})})}}],server:{watch:{ignored:['**/release/**','**/.test-runtime/**','**/artifacts/**','**/functions/node_modules/**','**/firebase-hosting/**']},proxy:{'/api':{target:'http://127.0.0.1:8081',changeOrigin:true}}}};
});
