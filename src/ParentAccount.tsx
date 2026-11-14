import {useAppText} from './parentLanguage';
import ModerationQueue from './ModerationQueue';
import CoParentDeletion from './CoParentDeletion';
import GoogleConfirmation from './GoogleConfirmation';
import {useAnimatedPresence} from './useAnimatedPresence';
import {useState,type FormEvent} from 'react';
import {api,type ApiMember} from './api';
import {parentGoogleOnly} from './backend';

export default function ParentAccount({members,onDeleted}:{members:ApiMember[];onDeleted:()=>Promise<void>}) {
 const translate=useAppText();
 const [reauthToken,setReauthToken]=useState('');
 const [requestedMode,setMode]=useState<'password'|'delete'|'pin'|'edit'|null>(null),[child,setChild]=useState<ApiMember|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const {value:mode,exiting}=useAnimatedPresence(requestedMode);
 const open=(next:typeof mode,member:ApiMember|null=null)=>{setReauthToken('');setMode(next);if(next!==null)setChild(member);setError('');setMessage('');};
 async function save(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(busy)return;const f=new FormData(e.currentTarget);setError('');
  if(mode==='password'&&f.get('newPassword')!==f.get('confirm')){setError('The new passwords do not match.');return;}
  setBusy(true);
  try{
   if(mode==='password'){await api.changePassword(String(f.get('currentPassword')),String(f.get('newPassword')),reauthToken);setMessage('Password changed. Other devices must sign in again.');}
   if(mode==='pin'&&child){await api.resetChildPin(child.id,String(f.get('pin')));setMessage(`PIN updated for ${child.display_name}.`);}
   if(mode==='edit'&&child){await api.updateProfile({childId:child.id,displayName:String(f.get('displayName')).trim(),age:Number(f.get('age'))});await onDeleted();setMessage('Child profile updated. Their tasks and progress are kept.');}
   if(mode==='delete'&&child){await api.deleteChild(child.id,String(f.get('password')),reauthToken);await onDeleted();setMessage(`${child.display_name}’s profile and progress were deleted.`);}
   setMode(null);
  }catch(err){setError(err instanceof Error?err.message:'Please try again.');}finally{setBusy(false);setReauthToken('');}
 }
 return <section className="card parent-account"><h2>{translate("Family & account")}</h2>{parentGoogleOnly?<p className="caption">Your parent account is managed by Google. <a href="https://accounts.google.com/signin/recovery" target="_blank" rel="noopener noreferrer">{translate("Google account recovery")}</a></p>:<button type="button" className="button secondary" onClick={()=>open('password')}>{translate("Change my password")}</button>}
 {members.filter(m=>m.role==='child').map(m=><div className="family-management-row" key={m.id}><div className="member-heading">{m.avatar_data?<img src={m.avatar_data} alt=""/>:<span>🧒</span>}<div><strong>{m.display_name}</strong><small>{m.age?`${m.age} years · `:''}Level {m.level} · {m.coins} coins</small></div></div><div><button type="button" className="text-button" onClick={()=>open('edit',m)}>{translate("Edit profile")}</button><button type="button" className="text-button" onClick={()=>open('pin',m)}>{translate("Reset child PIN")}</button><button type="button" className="text-button" disabled={busy} onClick={async()=>{setBusy(true);setMessage('');try{const result=await api.connectChildPhone(m.id);setMessage(`Phone connection code for ${m.display_name}: ${result.code}. Valid for 15 minutes, for this child only. Enter it with the child name and PIN on the other phone.`);}catch(e){setMessage(e instanceof Error?e.message:'Could not connect a phone.');}finally{setBusy(false)}}}>{translate("Connect another phone")}</button><button type="button" className="text-button danger-text" onClick={()=>open('delete',m)}>{translate("Delete profile")}</button></div></div>)}
 <ModerationQueue/><CoParentDeletion/>{message&&<p role="status">{message}</p>}
 {mode&&<div className={`modal-backdrop${exiting?' is-exiting':''}`} inert={exiting}><section className="modal" role="dialog" aria-modal="true" aria-label={mode==='password'?'Change password':mode==='edit'?'Edit child profile':mode==='pin'?translate("Reset child PIN"):'Delete child profile'}><form onSubmit={save}>{(mode==='password'||mode==='delete')&&<GoogleConfirmation value={reauthToken} onVerified={setReauthToken}/>}
 <h2>{mode==='password'?'Change password':mode==='edit'?`Edit ${child?.display_name}’s profile`:mode==='pin'?`Reset ${child?.display_name}’s PIN`:`Delete ${child?.display_name}’s profile?`}</h2>
 {mode==='edit'&&<><label>{translate("Child name")}<input autoFocus name="displayName" defaultValue={child?.display_name} required maxLength={80}/></label><label>{translate("Child age")}<select name="age" defaultValue={child?.age||8}>{Array.from({length:15},(_,i)=>i+4).map(a=><option key={a} value={a}>{a} years</option>)}</select></label></>}
 {mode==='edit'?null:mode==='password'?<><label>Current password<input autoFocus name="currentPassword" type="password" required={!reauthToken} autoComplete="current-password"/></label><label>New password<input name="newPassword" type="password" required minLength={8} maxLength={72} autoComplete="new-password"/></label><label>Confirm new password<input name="confirm" type="password" required minLength={8} maxLength={72} autoComplete="new-password"/></label></>:mode==='pin'?<label>New child PIN<input autoFocus name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="new-password"/></label>:<><p>This permanently deletes {child?.display_name}’s tasks, submissions, rewards balance and login. This cannot be undone.</p>{!parentGoogleOnly&&<label>Your parent password<input autoFocus name="password" type="password" required={!reauthToken} autoComplete="current-password"/></label>}</>}
 {error&&<p className="form-error" role="alert">{error}</p>}
 <button className="button" type="submit" disabled={busy}>{busy?'Saving…':mode==='delete'?'Permanently delete profile':mode==='edit'?translate("Save profile"):mode==='pin'?'Save child PIN':'Save password'}</button>
 <button className="button secondary" type="button" disabled={busy} onClick={()=>open(null)}>{translate("Cancel")}</button>
 </form></section></div>}</section>;
}
