import {useAppText} from './parentLanguage';
import {useState} from 'react';
import {api} from './api';
export default function SubmissionProof({id,name,onPreview}:{id:string;name:string;onPreview:(image:string)=>void}){
 const translate=useAppText();
 const [data,setData]=useState<{proofUrl:string|null;proofBeforeUrl:string|null}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <div>{!data?<button type="button" className="text-button" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{setData(await api.submissionProof(id))}catch(e){setError(e instanceof Error?e.message:'Could not load photos.')}finally{setBusy(false)}}}>{busy?'Loading photos…':'View photo proof'}</button>:<><div className={`review-proofs ${data.proofBeforeUrl?'':'single'}`}>{data.proofBeforeUrl&&<button type="button" className="proof-thumb" aria-label={`View before photo for ${name}`} onClick={()=>onPreview(data.proofBeforeUrl!)}><img loading="lazy" src={data.proofBeforeUrl} alt={`Before ${name}`}/><span>Before</span></button>}{data.proofUrl&&<button type="button" className="proof-thumb" aria-label={`View ${data.proofBeforeUrl?'after':'task'} photo for ${name}`} onClick={()=>onPreview(data.proofUrl!)}><img loading="lazy" src={data.proofUrl} alt={`Proof for ${name}`}/><span>{data.proofBeforeUrl?'After':translate("Photo proof")}</span></button>}</div><button type="button" className="text-button" onClick={()=>setData(null)}>Hide photos</button></>}{error&&<p className="form-error" role="alert">{error}</p>}</div>;
}
