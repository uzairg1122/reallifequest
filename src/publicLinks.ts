const env=(import.meta as ImportMeta&{env?:Record<string,string>}).env;
const configured=(env?.VITE_PUBLIC_APP_URL||'https://nomolabs.pro/real-life-quest').replace(/\/$/,'');
export const publicAppOrigin=new URL(configured).origin;
export function inviteLink(code:string,kind='invite'){return `${configured}/?${kind}=${encodeURIComponent(code)}`}
export const privacyUrl=`${configured}/privacy.html`;
export const deletionUrl=`${configured}/delete-account.html`;
