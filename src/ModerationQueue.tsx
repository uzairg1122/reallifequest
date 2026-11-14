import {useEffect,useState} from 'react';
import {api} from './api';
export default function ModerationQueue(){
 const [allowed,setAllowed]=useState(false),[reports,setReports]=useState<Array<{id:string;reason:string;details:string;created_at:string}>>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;api.authMethods().then(async r=>{if(r.moderator&&active){setAllowed(true);const data=await api.moderationReports();if(active)setReports(data.reports)}}).catch(()=>{});return()=>{active=false}},[]);
 if(!allowed)return null;
 return <section className="card"><h2>Safety moderation</h2>{error&&<p role="alert">{error}</p>}{reports.length===0&&<p>No open reports.</p>}{reports.map(r=><article key={r.id}><h3>{r.reason}</h3><p>{r.details||'No additional details.'}</p>{(['reviewed','hide_from_league','restore_eligibility'] as const).map(action=><button className="button secondary" disabled={busy} key={action} onClick={async()=>{setBusy(true);setError('');try{await api.moderateReport(r.id,action);setReports((await api.moderationReports()).reports)}catch(e){setError(e instanceof Error?e.message:'Action failed.')}finally{setBusy(false)}}}>{action==='reviewed'?'Mark reviewed':action==='restore_eligibility'?'Restore eligibility':'Remove from public league'}</button>)}</article>)}</section>;
}
