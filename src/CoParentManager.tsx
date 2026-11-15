import {useAppText} from './parentLanguage';
import {useCallback,useEffect,useRef,useState} from 'react';
import {UserPlus,RefreshCw,Copy,Check,Trash2,ShieldCheck} from 'lucide-react';
import {api,type FamilyParentsResponse} from './api';

export default function CoParentManager(){
 const translate=useAppText();
 const [data,setData]=useState<FamilyParentsResponse|null>(null),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true);
 const [invite,setInvite]=useState<{code:string;codeDisplay:string;inviteUrl:string}|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[copied,setCopied]=useState(false);
 const requestId=useRef(0);
 const refresh=useCallback(async()=>{
  const id=++requestId.current;
  try {
   const result=await api.familyParents();
   if(id===requestId.current){setData(result);setLoadError('');}
  }catch(e){
   if(id===requestId.current)setLoadError(e instanceof Error?e.message:'Could not load family members.');
  }finally{
   if(id===requestId.current)setLoading(false);
  }
 },[]);
 useEffect(()=>{
  void refresh();
  const refreshVisible=()=>{if(!document.hidden)void refresh();};
  const timer=window.setInterval(refreshVisible,10000);
  document.addEventListener('visibilitychange',refreshVisible);
  return ()=>{
   requestId.current++;
   window.clearInterval(timer);
   document.removeEventListener('visibilitychange',refreshVisible);
  };
 },[refresh]);
 async function makeCode(){setBusy(true);setMessage('');try{const r=await api.coParentCode();setInvite(r);}catch(e){setMessage(e instanceof Error?e.message:'Could not create an invite code.');}finally{setBusy(false);}}
 async function copyCode(){if(!invite)return;try{await navigator.clipboard.writeText(invite.code);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setMessage('Copy failed — read the code aloud instead.');}}
 async function changeRelationship(memberId:string,relationship:string){
  setBusy(true);setMessage('');
  try{await api.setRelationship(memberId,relationship);await refresh();}
  catch(e){setMessage(e instanceof Error?e.message:'Could not update the relationship.');}
  finally{setBusy(false);}
 }
 async function remove(id:string,name:string){if(!window.confirm(`Remove ${name} from this family? They will lose access to its children and tasks.`))return;setBusy(true);setMessage('');try{await api.removeCoParent(id);await refresh();setMessage(`${name} was removed.`);}catch(e){setMessage(e instanceof Error?e.message:'Could not remove that co-parent.');}finally{setBusy(false);}}
 return <section className="card coparent-manager">
  <div className="section-heading"><h3><ShieldCheck size={18}/> Adults {data&&<small>({data.parents.length})</small>}</h3><button type="button" className="text-button" aria-label="Refresh family members" onClick={()=>void refresh()}><RefreshCw size={16}/></button></div>
  {loading&&!data&&<p role="status" className="caption">{translate("Loading…")}</p>}
  {loadError&&<div><p role="alert" className="form-error">{loadError}</p><button className="text-button" onClick={()=>void refresh()}><RefreshCw size={15}/> Try again</button></div>}
  {data&&<ul className="coparent-list">{data.parents.map(p=><li key={p.id} className="coparent-row">
   <span className="parent-adult-avatar" aria-hidden="true">{p.displayName[0]}</span><div className="coparent-info"><strong>{p.displayName}</strong><small>{p.isPrimary?'Owner':'Caregiver'}{p.relationship?' · '+p.relationship:''}</small>{data.viewerIsPrimary&&<select aria-label={'Relationship for '+p.displayName} value={p.relationship??''} disabled={busy} onChange={e=>void changeRelationship(p.id,e.target.value)}><option value="">Relationship</option>{['Mother','Father','Grandmother','Grandfather','Brother','Sister','Other caregiver'].map(label=><option key={label}>{label}</option>)}</select>}</div>
   {data.viewerIsPrimary&&!p.isPrimary&&<button type="button" className="danger-text" aria-label={`Remove ${p.displayName}`} disabled={busy} onClick={()=>void remove(p.id,p.displayName)}><Trash2 size={16}/> Remove</button>}
  </li>)}</ul>}
  {data&&<div className="coparent-invite">
   <button className="button secondary" disabled={busy} onClick={()=>void makeCode()}><UserPlus size={16}/> Invite member</button>
   {invite&&<div className="coparent-code-box" role="status">
    <p className="caption">Share this code with a trusted adult to join as a caregiver (valid 24 hours):</p>
    <div className="coparent-code-row"><code className="coparent-code">{invite.codeDisplay}</code><button className="text-button" onClick={()=>void copyCode()}>{copied?<><Check size={15}/> Copied</>:<><Copy size={15}/> Copy</>}</button></div>
   </div>}
  </div>}
  {data&&!data.viewerIsPrimary&&<p className="caption">Only the family owner can remove caregivers.</p>}
  {message&&<p role="status" className="wallet-message">{message}</p>}
 </section>;
}
