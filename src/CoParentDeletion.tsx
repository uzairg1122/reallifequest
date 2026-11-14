import {useAppText} from './parentLanguage';
import {parentGoogleOnly} from './backend';
import {useEffect,useState} from 'react';
import {api,clearApiSession} from './api';
import GoogleConfirmation from './GoogleConfirmation';
export default function CoParentDeletion(){
 const translate=useAppText();
 const [allowed,setAllowed]=useState(false),[open,setOpen]=useState(false),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[proof,setProof]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;api.authMethods().then(r=>{if(active)setAllowed(r.primary===false)}).catch(()=>{});return()=>{active=false}},[]);
 if(!allowed)return null;
 return <section>{!open?<button className="text-button danger-text" onClick={()=>setOpen(true)}>Delete my co-parent account</button>:<><h3>Delete your co-parent account?</h3><p>The family and its children’s progress will stay. Your access and account will be removed.</p><GoogleConfirmation value={proof} onVerified={setProof}/>{!parentGoogleOnly&&<label>Your password (or Google verification)<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>}<label>Type DELETE MY ACCOUNT<input value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<button className="button" disabled={busy||confirm!=='DELETE MY ACCOUNT'} onClick={async()=>{setBusy(true);setError('');try{await api.deleteSelf({password,reauthToken:proof,confirm});clearApiSession();localStorage.removeItem('rlq_started');location.reload()}catch(e){setError(e instanceof Error?e.message:'Please try again.');setProof('')}finally{setBusy(false)}}}>Delete my account</button><button disabled={busy} className="button secondary" onClick={()=>{setOpen(false);setProof('');setPassword('');setConfirm('')}}>{translate("Cancel")}</button></>}</section>;
}
