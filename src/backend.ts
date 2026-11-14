const env=(import.meta as ImportMeta&{env?:Record<string,string>}).env||{};
export const firebaseEnabled=env.VITE_BACKEND_PROVIDER==='firebase';
export const sessionPrefix=firebaseEnabled?'real_life_quest_firebase_':'real_life_quest_api_';
export const firebaseApiBase=env.VITE_FIREBASE_API_BASE_URL||'';
export const parentGoogleOnly=env.VITE_PARENT_AUTH_MODE==='google';
