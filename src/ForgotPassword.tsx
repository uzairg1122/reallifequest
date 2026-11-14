import {useState} from 'react';
import {api} from './api';
export default function ForgotPassword(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 return <><button type="button" className="text-button" disabled={busy} onClick={async e=>{const field=e.currentTarget.form?.elements.namedItem('email') as HTMLInputElement|null;if(!field?.value||!field.reportValidity()){setMessage('Enter your parent email above first.');return}setBusy(true);setMessage('');try{const r=await api.requestPasswordReset(field.value);setMessage(r.message)}catch(e){setMessage(e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}}}>{busy?'Requesting link…':'Forgot password?'}</button>{message&&<p role="status" className="caption">{message}</p>}</>;
}
