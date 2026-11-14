import {useAppText} from './parentLanguage';
import {useState, type FormEvent} from 'react';
import {pairedChild} from './sessionStorage';

export default function KidAccountScreen({busy,error,onSubmit,onBack}:{
 busy:boolean;
 error:string;
 onSubmit:(event:FormEvent<HTMLFormElement>)=>void;
 onBack:()=>void;
}){
 const translate=useAppText();
 const invite=new URLSearchParams(location.search).get('invite')||'';
 const [joining,setJoining]=useState(Boolean(invite));
 const [connecting,setConnecting]=useState(false);
 const [showError,setShowError]=useState(true);
 const paired=pairedChild();

 function choose(join:boolean){
  setJoining(join);
  setConnecting(false);
  setShowError(false);
 }

 function submit(event:FormEvent<HTMLFormElement>){
  if(joining){
   const form=new FormData(event.currentTarget);
   if(form.get('pin')!==form.get('confirmPin')){
    event.preventDefault();
    const field=event.currentTarget.elements.namedItem('confirmPin') as HTMLInputElement;
    field.setCustomValidity('Enter the same PIN again.');
    field.reportValidity();
    return;
   }
  }
  setShowError(true);
  onSubmit(event);
 }

 return <main className="login-screen account-polished kid-account-screen">
  <button className="icon-button" aria-label={translate("Back")} onClick={onBack}>←</button>
  <div className="account-symbol" aria-hidden="true">🌟</div>
  <h1>Hi, little hero!</h1>
  <div className="kid-account-actions" role="group" aria-label="Choose how to start">
   <button type="button" aria-pressed={!joining} onClick={()=>choose(false)} disabled={busy}>{translate("Sign in")}</button>
   <button type="button" aria-pressed={joining} onClick={()=>choose(true)} disabled={busy}>{translate("Join a family")}</button>
  </div>
  <form key={joining?'join':connecting?'connect':'sign-in'} className="login-form" onSubmit={submit}>
   <input type="hidden" name="action" value={joining?'register':'login'}/>
   <label>{translate("Your name")}<input name="displayName" required maxLength={80} autoComplete="given-name" defaultValue={!joining&&!connecting?paired?.name:undefined} placeholder="Enter your name"/></label>
   {joining&&<label>{translate("Family code")}<input name="code" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} defaultValue={invite} placeholder="6 digits from your parent"/></label>}
   <label>{joining?'Make a PIN':translate("Your PIN")}<input name="pin" type="password" required inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="4 numbers" autoComplete={joining?'new-password':'current-password'}/></label>
   {joining?<><label>Enter your PIN again<input name="confirmPin" type="password" required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} autoComplete="new-password" onInput={event=>event.currentTarget.setCustomValidity('')}/></label><label>Your age<select name="age" defaultValue="8">{Array.from({length:15},(_,i)=>i+4).map(age=><option key={age} value={age}>{age} years</option>)}</select></label></>:<>
    <input type="hidden" name="pairedChild" value={paired?.id||''}/>
    {connecting&&<><label>{translate("Phone code")}<input name="deviceCode" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="6 digits from your parent"/></label><p className="caption">Ask your parent for a code from Family &amp; account → Connect another phone.</p></>}
   </>}
   {showError&&error&&<p className="form-error" role="alert">{error}</p>}
   {!joining&&!connecting&&!paired&&<p className="caption">Connect this phone once to sign in with your name and PIN.</p>}
   <button className="button" type="submit" disabled={busy||(!joining&&!connecting&&!paired)}>{busy?'One moment…':joining?'Join my family':connecting?'Connect phone':'Let’s go!'} →</button>
   {!joining&&<button className="text-button kid-connect-toggle" type="button" disabled={busy} aria-expanded={connecting} onClick={()=>{setConnecting(!connecting);setShowError(false);}}>{connecting?'Back to sign in':'Connect a phone'}</button>}
  </form>
 </main>;
}
