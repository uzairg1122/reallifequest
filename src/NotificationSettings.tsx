import {useAppText} from './parentLanguage';
import {useEffect,useId,useState} from 'react';
import {api} from './api';
import {nativeNotificationsAvailable,phoneNotifications,registerPhoneNotifications,type PhoneNotificationStatus} from './phoneNotifications';
import './notification-settings.css';
export default function NotificationSettings({userId}:{userId:string}){
 const translate=useAppText();
 const soundId=useId();
 const [status,setStatus]=useState<PhoneNotificationStatus|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let cancelled=false;if(nativeNotificationsAvailable())void phoneNotifications.status().then(s=>{if(!cancelled)setStatus(s);}).catch(()=>{if(!cancelled)setMessage('Phone notification settings could not load. Reopen this screen to retry.');});return()=>{cancelled=true;};},[userId]);
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');try{await action();}catch(e){setMessage(e instanceof Error?e.message:'Could not update phone notifications.');}finally{setBusy(false);}}
 async function enable(){const next=await phoneNotifications.enable();setStatus(next);if(next.permission)await registerPhoneNotifications();}
 async function disable(){const next=await phoneNotifications.disable();setStatus(next);await api.registerPushDevice({installationId:next.installationId,disable:true});}
 if(!nativeNotificationsAvailable())return <section className="card notification-settings"><h3>{translate("Phone notifications")}</h3><p>Background notifications and custom audio are available in the Android app.</p></section>;
 return <section className="card notification-settings" aria-busy={busy}>
  <h3>{translate("Phone notifications & sounds")}</h3>
  <div className="notification-toggle-row">
   <span>{translate("Phone notifications")}</span>
   <button type="button" role="switch" aria-label={translate("Phone notifications")} aria-checked={Boolean(status?.enabled&&status.permission)} className={`toggle ${status?.enabled&&status.permission?'on':''}`} disabled={busy||!status} onClick={()=>void run(status?.enabled&&status.permission?disable:enable)}><i/></button>
  </div>
  {status&&!status.permission&&<p role="status">{translate('Android permission is off')}</p>}
  <label htmlFor={soundId}>{translate("Notification sound")}</label><select id={soundId} value={status?.sound??'gentle'} disabled={!status||busy} onChange={e=>{const value=e.target.value;void run(async()=>{setStatus(await phoneNotifications.setSound({sound:value}));await registerPhoneNotifications();});}}>
   <option value="gentle">{translate("Gentle chime")}</option><option value="bright">{translate("Bright chime")}</option><option value="soft">{translate("Soft bell")}</option><option value="default">{translate("Phone default")}</option><option value="silent">{translate("Silent")}</option>{status?.customName&&<option value="custom">{status.customName}</option>}
  </select>
  <div className="notification-actions">
   <button type="button" disabled={busy||!status} onClick={()=>void run(async()=>{const next=await phoneNotifications.importSound();if(!next.cancelled){setStatus(next);await registerPhoneNotifications();}})}>{translate("Add custom audio")}</button>
   <button type="button" disabled={busy||!status} onClick={()=>void run(()=>phoneNotifications.systemSettings())}>{translate("Android notification settings")}</button>
  </div>
  {message&&<p role="status" className="notification-message">{message}</p>}
 </section>;
}
