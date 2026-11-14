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
 const [googleInvite,setGoogleInvite]=useState(coparent);
 if(role==='kid')return <KidAccountScreen busy={busy} error={error} onSubmit={onSubmit} onBack={onBack}/>;
 if(parentGoogleOnly)return <main className="login-screen account-polished parent-account-screen"><button className="icon-button" aria-label={translate("Back")} onClick={onBack}>←</button><div className="account-symbol">🛡️</div><span className="eyebrow">PARENT SPACE</span><h1>{googleInvite?'Join your family team':'Welcome to your family adventure'}</h1><p>Use your Google account to create your family or return to your saved progress.</p>{coparent&&<label>Co-parent invite code<input inputMode="numeric" maxLength={6} value={googleInvite} onChange={e=>setGoogleInvite(e.target.value.replace(/\D/g,''))} disabled={busy}/></label>}<GoogleSignIn disabled={busy||Boolean(googleInvite&&googleInvite.length!==6)} onSuccess={onGoogleSuccess} coParentCode={googleInvite||undefined}/>{error&&<p className="form-error" role="alert">{error}</p>}<p className="caption">Your Google account manages your sign-in. There is no separate app password.</p><a className="text-button" href="https://accounts.google.com/signin/recovery" target="_blank" rel="noopener noreferrer">Need help recovering your Google account?</a>{googleInvite&&<button className="text-button" onClick={()=>setGoogleInvite('')}>Already joined? Sign in without an invite</button>}</main>;
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
   {action==='coparent'&&<label>Family invite code<input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} defaultValue={coparent} placeholder="6 digits from the primary parent"/></label>}
   {action==='login'&&<ForgotPassword/>}
   {error&&<p className="form-error" role="alert">{error}</p>}
   <button className="button" type="submit" disabled={busy}>{busy?'Opening your adventure…':action==='login'?translate("Sign in"):action==='coparent'?'Join family':'Create family'} →</button>
  </form>
 </main>;
}
