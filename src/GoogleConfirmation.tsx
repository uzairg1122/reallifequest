import {useEffect,useState} from 'react';
import {api} from './api';
import {googleIdToken} from './googleAuth';
import {parentGoogleOnly} from './backend';

export default function GoogleConfirmation({value,onVerified}:{value:string;onVerified:(token:string)=>void}){
 const [available,setAvailable]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let active=true;api.authMethods().then(r=>{if(active)setAvailable(r.google)}).catch(()=>{});return()=>{active=false}},[]);
 if(!available)return null;
 return <div className="google-confirmation"><p className="caption">{parentGoogleOnly?'Verify your Google account to confirm this action.':'You can confirm with your Google account instead of a password.'}</p><button type="button" className="button secondary" disabled={busy||Boolean(value)} onClick={async()=>{
  setBusy(true);setError('');try{const {nonce}=await api.googleChallenge();const idToken=await googleIdToken(nonce);const result=await api.reauthGoogle({nonce,idToken});onVerified(result.reauthToken)}catch(e){setError(e instanceof Error?e.message:'Could not verify Google account.')}finally{setBusy(false)}
 }}>{busy?'Verifying…':value?'Google verified for this action':'Verify with Google'}</button>{error&&<p role="alert" className="form-error">{error}</p>}</div>;
}
