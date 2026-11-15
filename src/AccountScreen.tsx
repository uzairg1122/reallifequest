import {useAppText} from './parentLanguage';
import ForgotPassword from './ForgotPassword';
import GoogleSignIn from './GoogleSignIn';
import KidAccountScreen from './KidAccountScreen';
import type {ApiSession} from './api';
import {useState,type FormEvent} from 'react';
import {parentGoogleOnly} from './backend';

export default function AccountScreen({role,busy,error,onSubmit,onBack,onGoogleSuccess}:{role:'parent'|'kid';busy:boolean;error:string;onSubmit:(e:FormEvent<HTMLFormElement>)=>void;onBack:()=>void;onGoogleSuccess:(session:ApiSession)=>void}){
 const translate=useAppText();
 const coparent=new URLSearchParams(location.search).get('coparent')||'';
 const [action,setAction]=useState(coparent?'coparent':'register');
 const [googleInvite,setGoogleInvite]=useState(coparent.replace(/\D/g,'').slice(0,6));
 const [step,setStep]=useState<'sign-in'|'code'|'google'>(()=>googleInvite.length===6?'google':coparent?'code':'sign-in');
 if(role==='kid')return <KidAccountScreen busy={busy} error={error} onSubmit={onSubmit} onBack={onBack}/>;
 if(parentGoogleOnly)return <main className="login-screen account-polished parent-account-screen">
  <button type="button" className="icon-button" aria-label={translate("Back")} onClick={()=>{
   if(step==='google'){setGoogleInvite('');setStep('code');}
   else if(step==='code')setStep('sign-in');
   else onBack();
  }}>←</button>
  <div key={step} className="parent-sign-in-step">
  <div className="account-symbol" aria-hidden="true">🛡️</div>
  <span className="eyebrow">{step==='google'?'STEP 2 OF 2 · LAST STEP':step==='code'?'STEP 1 OF 2':'PARENT SPACE'}</span>
  <h1>{step==='code'?'Enter your family code':step==='google'?'Join your family':'Welcome to your family adventure'}</h1>
  <p>{step==='code'?'Enter the 6-digit code from the family owner.':step==='google'?'Continue with your own Google account to join the family.':'Sign in with Google to open your family dashboard.'}</p>
  {step==='code'?<label className="parent-invite-code">Family invite code
   <span className="parent-invite-code-field">
    <span className="parent-invite-code-boxes" aria-hidden="true">{Array.from({length:6},(_,i)=><span key={i}>{googleInvite[i]||''}</span>)}</span>
    <input autoComplete="one-time-code" inputMode="numeric" value={googleInvite} onChange={e=>{
     const code=e.target.value.replace(/\D/g,'').slice(0,6);
     setGoogleInvite(code);
     if(code.length===6){e.currentTarget.blur();setStep('google');}
    }} disabled={busy}/>
   </span>
  </label>:<GoogleSignIn key={step} disabled={busy} onSuccess={onGoogleSuccess} coParentCode={step==='google'?googleInvite:undefined}/>}
  {error&&<p className="form-error" role="alert">{error}</p>}
  {step==='google'&&<div className="parent-sign-in-actions"><button type="button" className="button secondary" onClick={()=>{setGoogleInvite('');setStep('code');}}>Change invite code</button></div>}
  {step==='sign-in'&&<div className="parent-sign-in-actions">
   <a className="text-button" href="https://accounts.google.com/signin/recovery" target="_blank" rel="noopener noreferrer">Need help recovering your Google account?</a>
   <button type="button" className="button secondary" onClick={()=>{setGoogleInvite('');setStep('code');}}>I have a family invite code</button>
  </div>}
  </div>
 </main>;
 return <main className="login-screen account-polished parent-account-screen">
  <button className="icon-button" aria-label={translate("Back")} onClick={onBack}>←</button>
  <div className="account-symbol">🛡️</div><span className="eyebrow">PARENT SPACE</span>
  <h1>{action==='login'?'Welcome back!':action==='coparent'?'Join as a co-parent':'Build your family team'}</h1>
  <p>{action==='coparent'?'Enter the invite code from the primary parent to help manage the family.':'A little teamwork. A lot of adventure.'}</p>
  {action!=='coparent'&&<GoogleSignIn disabled={busy} onSuccess={onGoogleSuccess}/>}
  <form className="login-form" onSubmit={onSubmit}>
   <label>Account action<select name="action" value={action} onChange={e=>setAction(e.target.value)}><option value="login">{translate("Sign in")}</option><option value="register">Create family account</option><option value="coparent">Join as a co-parent</option></select></label>
   {action!=='login'&&<label>{translate("Your name")}<input name="displayName" required maxLength={80} autoComplete="given-name" placeholder={translate("Your name")}/></label>}
   <label>Email<input name="email" type="email" required autoComplete="username" placeholder="parent@example.com"/></label>
   <label>Password<input name="password" type="password" required minLength={8} maxLength={72} autoComplete={action==='login'?'current-password':'new-password'} placeholder="At least 8 characters"/></label>
   {action==='coparent'&&<label>Family invite code<input name="code" required inputMode="numeric" pattern="[0-9]{6}" onInput={e=>{e.currentTarget.value=e.currentTarget.value.replace(/\D/g,'').slice(0,6);}} defaultValue={coparent.replace(/\D/g,'').slice(0,6)} placeholder="6 digits from the primary parent"/></label>}
   {action==='login'&&<ForgotPassword/>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button className="button" type="submit" disabled={busy}>{busy?'Opening your adventure…':action==='login'?translate("Sign in"):action==='coparent'?'Join family':'Create family'} →</button>
  </form>
 </main>;
}
