import {useAppText} from './parentLanguage';
import {useState} from 'react';
import {Camera,ImagePlus,Trash2,Check} from 'lucide-react';
import {preparePhoto} from './photos';
import {Capacitor} from '@capacitor/core';
import {Camera as NativeCamera,CameraResultType,CameraSource,CameraDirection} from '@capacitor/camera';
import {photoMode,proofError} from './proof';
import type {Quest} from './state';
import './photo-proof.css';

type Draft={before:string;after:string};
export default function PhotoProof({quest,owner,onSubmit,onBack}:{quest:Quest;owner:string;onSubmit:(after?:string,before?:string)=>Promise<boolean>;onBack:()=>void}){
 const translate=useAppText();
 const mode=photoMode(quest),paired=mode==='before_after',key=`rlq_proof_draft_${owner}_${quest.id}`;
 const [draft,setDraft]=useState<Draft>(()=>{try{const saved=JSON.parse(localStorage.getItem(key)||'{}');return {before:typeof saved.before==='string'?saved.before:'',after:typeof saved.after==='string'?saved.after:''};}catch{return {before:'',after:''};}});
 const [preparing,setPreparing]=useState(false),[sending,setSending]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 function keep(next:Draft){setDraft(next);setSaved(false);try{localStorage.setItem(key,JSON.stringify(next));setSaved(true);}catch{setError('This device is out of storage. Keep this screen open until you submit your photos.');}}
 async function choose(slot:keyof Draft,file?:File){if(!file)return;setPreparing(true);setError('');try{const data=await preparePhoto(file);keep({...draft,[slot]:data});}catch(e){setError((e as Error).message);}finally{setPreparing(false);}}
 async function takePhoto(slot:keyof Draft){setPreparing(true);setError('');try{
  const photo=await NativeCamera.getPhoto({source:CameraSource.Camera,direction:CameraDirection.Rear,resultType:CameraResultType.Uri,quality:85,width:1200,height:1200,correctOrientation:true,saveToGallery:false});
  if(!photo.webPath)throw Error('The camera did not return a photo. Please try again.');
  const response=await fetch(photo.webPath);const blob=await response.blob();
  keep({...draft,[slot]:await preparePhoto(new File([blob],'task-photo.jpg',{type:blob.type||'image/jpeg'}))});
 }catch(e){const message=e instanceof Error?e.message:String(e);if(!/cancel/i.test(message))setError(message||'Could not open the camera. Please try again.');}finally{setPreparing(false);}}
 const problem=proofError(mode,draft.after,draft.before),busy=preparing||sending;
 const slots:Array<{key:keyof Draft;title:string;help:string}>=paired?[{key:'before',title:'Before',help:'Take this before you start.'},{key:'after',title:'After',help:'Show your finished work.'}]:[{key:'after',title:'Your task photo',help:mode==='required'?'A photo is required for this mission.':'A photo is optional for this mission.'}];
 return <div className={`photo-proof ${paired?'paired-proof':''}`}>
  <div className="proof-intro"><span className="quest-chip">{quest.icon} {quest.name}</span><h2>{paired?translate("Before & after"):translate("Show your amazing work!")}</h2><p>{paired?'Show your parent the difference you made.':'Photograph your task, then send it for review.'}</p></div>
  <div className="proof-slots">{slots.map(slot=><section className="proof-slot card" key={slot.key}><h3>{paired?<span>{slot.key==='before'?'1':'2'}</span>:null}{slot.title}</h3><p>{slot.help}</p><div className={`proof-image ${draft[slot.key]?'has-photo':''}`}>{draft[slot.key]?<img src={draft[slot.key]} alt={`${slot.title} photo preview`}/>:<Camera size={42}/>}</div>
   <div className="proof-pickers">{Capacitor.getPlatform()==='android'?<button type="button" className="proof-picker" disabled={busy} aria-label={`Take ${slot.title.toLowerCase()} photo`} onClick={()=>void takePhoto(slot.key)}><Camera size={16}/>{draft[slot.key]?'Retake':translate("Take Photo")}</button>:<label className={`proof-picker ${busy?'disabled':''}`}><Camera size={16}/>{draft[slot.key]?'Retake':translate("Take Photo")}<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label={`Take ${slot.title.toLowerCase()} photo`} disabled={busy} onChange={e=>{void choose(slot.key,e.target.files?.[0]);e.target.value='';}}/></label>}<label className={`proof-picker secondary ${busy?'disabled':''}`}><ImagePlus size={16}/>{translate("Gallery")}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Choose ${slot.title.toLowerCase()} from gallery`} disabled={busy} onChange={e=>{void choose(slot.key,e.target.files?.[0]);e.target.value='';}}/></label></div>
   {draft[slot.key]&&<button className="text-button remove-proof" aria-label={`Remove ${slot.title.toLowerCase()} photo`} disabled={busy} onClick={()=>{setError('');keep({...draft,[slot.key]:''});}}><Trash2 size={14}/> Remove photo</button>}
  </section>)}</div>
  {preparing&&<p role="status" className="caption">Preparing your photo…</p>}{saved&&!error&&<p role="status" className="proof-draft-note"><Check size={14}/> Photos saved on this device. You can come back later.</p>}
  {error&&<p role="alert" className="form-error">{error}</p>}
  {problem&&<p className="caption">{problem}</p>}
  <button className="button" disabled={busy||!!problem} onClick={async()=>{setSending(true);setError('');try{const ok=await onSubmit(draft.after||undefined,paired?draft.before||undefined:undefined);if(ok){try{localStorage.removeItem(key);}catch{/* Submitted photos already exist on the server. */}}else setError('Could not send your photos. They are kept here so you can try again.');}catch(e){setError((e as Error).message);}finally{setSending(false);}}}>{sending?'Sending…':paired?'Submit Before & After':draft.after?'Submit Photo':'Submit Without Photo'}</button>
  <button className="text-button full" disabled={busy} onClick={onBack}>Save for later</button><p className="caption">Only your family can review submitted photos. Coins arrive after parent approval.</p>
 </div>;
}
