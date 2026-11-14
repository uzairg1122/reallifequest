import {useAppText} from './parentLanguage';
import {useEffect,useState} from 'react';
import {Camera,ChevronRight,Settings} from 'lucide-react';
import {preparePhoto} from './photos';
import coinsArt from '../assets/kid-redesign/rewards/coins.png';
import medalArt from '../assets/kid-redesign/profile/achievement.png';

type Props={name:string;photo:string;avatar:string;level:number;xp:number;coins:number;completed:number;waiting:number;onSave:(photo:string)=>Promise<void>;onSettings:()=>void;onWallet:()=>void;onQuests:()=>void};
export default function ChildProfile({name,photo,avatar,level,xp,coins,completed,waiting,onSave,onSettings,onWallet,onQuests}:Props){
 const translate=useAppText();
 const [preview,setPreview]=useState(photo),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{setPreview(photo);},[photo]);
 return <div className="child-profile">
  <section className="profile-hero card"><span className="profile-star star-left" aria-hidden="true">✦</span><span className="profile-star star-right" aria-hidden="true">✧</span>
   <div className={`profile-picture-preview ${!preview&&avatar==='🧒'?'leo-avatar':''}`}>{preview?<img src={preview} alt="Your profile picture"/>:avatar!=='🧒'?<span>{avatar}</span>:null}</div>
   <h2>{name}</h2><p className="hero-level">Level {level} Adventurer</p>
   <div className="xp" role="progressbar" aria-label="Level progress" aria-valuemin={0} aria-valuemax={500} aria-valuenow={xp%500}><div style={{width:`${xp%500/5}%`}}/><span>XP {xp%500} / 500</span></div><small className="next-level">{500-xp%500} XP to your next level</small>
  </section>
  <div className="profile-stats"><button className="card" onClick={onWallet}><img src={coinsArt} alt=""/><strong>{coins.toLocaleString()}</strong><small>My coins</small></button><button className="card" onClick={onQuests}><img src={medalArt} alt=""/><strong>{completed}</strong><small>Approved quests</small></button></div>
  {waiting>0&&<p className="caption">⏳ {waiting} {waiting===1?'quest is':'quests are'} waiting for your parent.</p>}
  <section className="card profile-editor"><h3>{translate("My hero picture")}</h3><p>{translate("Choose a picture for your adventure.")}</p><label className="photo-picker"><Camera size={18}/> {translate("Choose a picture")}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);setMessage('');setError(false);try{setPreview(await preparePhoto(file,320));}catch(error){setError(true);setMessage((error as Error).message);}finally{setBusy(false);e.target.value='';}}}/></label><button className="button" disabled={busy||preview===photo} onClick={async()=>{setBusy(true);setMessage('');setError(false);try{await onSave(preview);setMessage('Your hero picture is saved!');}catch(error){setError(true);setMessage((error as Error).message);}finally{setBusy(false);}}}>{busy?'Saving…':'Save my picture'}</button><button className="text-button full" disabled={busy||!preview} onClick={()=>{setPreview('');setMessage('');}}>Use default avatar</button>{message&&<p className={error?'form-error':'profile-saved'} role={error?'alert':'status'}>{message}</p>}</section>
  <button className="card profile-settings" onClick={onSettings}><Settings size={22}/><div><strong>{translate("Settings")}</strong><small>Sound, notifications & account</small></div><ChevronRight size={20}/></button>
 </div>;
}
