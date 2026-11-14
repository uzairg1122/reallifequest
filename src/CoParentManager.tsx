import {useAppText} from './parentLanguage';
import {useEffect,useState} from 'react';
import {UserPlus,RefreshCw,Copy,Check,Trash2,ShieldCheck} from 'lucide-react';
import {api,type FamilyParentsResponse} from './api';

export default function CoParentManager(){
 const translate=useAppText();
 const [data,setData]=useState<FamilyParentsResponse|null>(null),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true);
 const [invite,setInvite]=useState<{code:string;codeDisplay:string;inviteUrl:string}|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[copied,setCopied]=useState(false);
 const refresh=()=>api.familyParents().then(result=>{setData(result);setLoadError('');}).catch(e=>setLoadError(e instanceof Error?e.message:'Could not load parents.')).finally(()=>setLoading(false));
 useEffect(()=>{void refresh();},[]);
 async function makeCode(){setBusy(true);setMessage('');try{const r=await api.coParentCode();setInvite(r);}catch(e){setMessage(e instanceof Error?e.message:'Could not create an invite code.');}finally{setBusy(false);}}
 async function copyCode(){if(!invite)return;try{await navigator.clipboard.writeText(invite.codeDisplay);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setMessage('Copy failed — read the code aloud instead.');}}
 async function remove(id:string,name:string){if(!window.confirm(`Remove ${name} as a co-parent? They will lose access to this family.`))return;setBusy(true);setMessage('');try{await api.removeCoParent(id);await refresh();setMessage(`${name} was removed.`);}catch(e){setMessage(e instanceof Error?e.message:'Could not remove that co-parent.');}finally{setBusy(false);}}
 return <section className="card coparent-manager">
  <div className="section-heading"><h3><ShieldCheck size={18}/> {translate("Parents & co-parents")}</h3></div>
  {loading&&!data&&<p role="status" className="caption">{translate("Loading…")}</p>}
  {loadError&&<div><p role="alert" className="form-error">{loadError}</p><button className="text-button" onClick={()=>void refresh()}><RefreshCw size={15}/> Try again</button></div>}
  {data&&<ul className="coparent-list">{data.parents.map(p=><li key={p.id} className="coparent-row">
   <div className="coparent-info"><strong>{p.displayName}</strong><small>{p.email} · {p.isPrimary?'Primary parent':'Co-parent'}</small></div>
   {data.viewerIsPrimary&&!p.isPrimary&&<button className="icon-button danger" aria-label={`Remove ${p.displayName}`} disabled={busy} onClick={()=>void remove(p.id,p.displayName)}><Trash2 size={16}/></button>}
  </li>)}</ul>}
  {data&&data.viewerIsPrimary&&<div className="coparent-invite">
   <button className="button secondary" disabled={busy} onClick={()=>void makeCode()}><UserPlus size={16}/> Invite a co-parent</button>
   {invite&&<div className="coparent-code-box" role="status">
    <p className="caption">Ask your partner to sign up as a co-parent with this code (valid 24 hours):</p>
    <div className="coparent-code-row"><code className="coparent-code">{invite.codeDisplay}</code><button className="text-button" onClick={()=>void copyCode()}>{copied?<><Check size={15}/> Copied</>:<><Copy size={15}/> Copy</>}</button></div>
   </div>}
  </div>}
  {data&&!data.viewerIsPrimary&&<p className="caption">Only the primary parent can invite or remove co-parents.</p>}
  {message&&<p role="status" className="wallet-message">{message}</p>}
 </section>;
}
