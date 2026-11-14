import {useAppText} from './parentLanguage';
import {useEffect,useState} from 'react';
import {Shield,RefreshCw,ChevronUp,ChevronDown,Minus,Flag,ShieldOff} from 'lucide-react';
import {api,PRESET_REACTIONS,REPORT_REASONS,REPORT_REASON_LABELS,type LeagueResponse,type LeagueGroup} from './api';

const BAND_LABEL:Record<LeagueGroup['ageBand'],string>={little:'Little (6–9)',junior:'Junior (10–12)',teen:'Teen (13–16)'};
const DIVISION_EMOJI:Record<number,string>={1:'🥇',2:'🥈',3:'🥉'};
const rankMedal=(rank:number)=>rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`#${rank}`;
const moveIcon=(m:string)=>m==='promoted'?<ChevronUp size={14}/>:m==='relegated'?<ChevronDown size={14}/>:<Minus size={14}/>;

// Spec 7.1: Little band is family-board-only by default, so the parent gets a clear
// explanation and a switch rather than an empty league screen.
function OptedOutNote({g,onEnable,busy}:{g:LeagueGroup;onEnable:(id:string)=>void;busy:boolean}){
 return <div className="league-opted-out">
  <span aria-hidden="true">🔒</span>
  <div>
   <strong>{g.childName} is family-board only</strong>
   <p>{g.optedOutReason==='consent_required'
     ?'Give consent for this child first. Nothing is shown to other families until you do.'
     :g.optedOutReason==='moderation'?'Public league participation is paused. Contact support@nomolabs.pro for help.':'Public leagues are off for this child. You can turn them on at any time.'}</p>
  </div>
  {g.optedOutReason==='parent_opt_out'&&<button className="text-button" disabled={busy} onClick={()=>onEnable(g.childId)}>Join public leagues <ChevronUp size={15}/></button>}
 </div>;
}

function LeagueSection({g,showName,onEnable,onReact,onReport,busy}:{
 g:LeagueGroup;showName:boolean;onEnable:(id:string)=>void;
 onReact:(userId:string,emoji:string)=>void;onReport:(userId:string,name:string)=>void;busy:boolean}){
 return <section className="card league-board">
  <div className="section-heading">
   <h3>{showName?`${g.childName} — `:''}{g.optedOut?'Family board':`${DIVISION_EMOJI[g.division]||''} ${g.divisionName} League`}</h3>
   <span>{BAND_LABEL[g.ageBand]}</span>
  </div>
  {g.optedOut?<OptedOutNote g={g} onEnable={onEnable} busy={busy}/>:
   g.entries.length?<ol className="league-list">{g.entries.map(e=><li key={e.id} className={`league-row${e.isMe?' me':''}${e.rank<=3?' podium':''}`}>
    <span className="league-rank" aria-label={`Rank ${e.rank}`}>{rankMedal(e.rank)}</span>
    {e.avatar_data?<img className="league-avatar" src={e.avatar_data} alt=""/>:<span className="league-avatar placeholder" aria-hidden="true">🧒</span>}
    <div className="league-name"><strong>{e.display_name}{e.isMe?' (you)':''}</strong>
     {/* Spec 10.3: preset reactions only. There is no free-text field anywhere. */}
     {!e.isMe&&<span className="league-reactions">{PRESET_REACTIONS.map(r=><button key={r} aria-label={`React ${r} to ${e.display_name}`} disabled={busy} onClick={()=>onReact(e.id,r)}>{r}</button>)}<button aria-label={`Report or block ${e.display_name}`} disabled={busy} onClick={()=>onReport(e.id,e.display_name)}><Flag size={12}/></button></span>}
    </div>
    <span className="league-xp">{e.xp.toLocaleString()} XP</span>
   </li>)}</ol>:<p className="caption">No XP earned in this division yet this week. Finish a mission to take the lead!</p>}
  {g.history.length>0&&<div className="league-history">
   <span className="league-history-title">Recent seasons</span>
   <ul>{g.history.map(h=><li key={h.week} className={`league-history-row ${h.movement}`}>
    <span className="league-history-week">{h.week}</span>
    <span className="league-history-div">{h.divisionName} · #{h.rank}</span>
    <span className={`league-move ${h.movement}`}>{moveIcon(h.movement)} {h.movement}</span>
   </li>)}</ul>
  </div>}
 </section>;
}

export default function OnlineLeague({parent}:{parent:boolean}){
 const translate=useAppText();
 const [data,setData]=useState<LeagueResponse|null>(null),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 // Spec 10.3: report & block. The report reason is a fixed set, so a report always lands
 // in a triage bucket and a child can never write to another family.
 const [reportFor,setReportFor]=useState<{id:string;name:string;reason:string}|null>(null);
 const refresh=()=>api.league().then(result=>{setData(result);setLoadError('');}).catch(e=>setLoadError(e instanceof Error?e.message:'Could not load the league.')).finally(()=>setLoading(false));
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer);},[]);
 const enable=async(childId:string)=>{setBusy(true);setNote('');try{await api.setLeagueOptIn(childId,true);setNote('This child is now on the public leagues. You can turn it off in Privacy & Safety.');await refresh();}catch(e){setLoadError(e instanceof Error?e.message:'Could not join the public league.');}finally{setBusy(false);}};
 const react=async(userId:string,emoji:string)=>{setBusy(true);setNote('');try{await api.react(userId,emoji);setNote(`Sent ${emoji}`);}catch(e){setLoadError(e instanceof Error?e.message:'Could not send that reaction.');}finally{setBusy(false);}};
 const submitReport=async()=>{if(!reportFor)return;setBusy(true);setNote('');try{await api.reportUser(reportFor.id,reportFor.reason);setNote(`${reportFor.name} was reported and blocked. They will not appear again.`);setReportFor(null);await refresh();}catch(e){setLoadError(e instanceof Error?e.message:'Could not send that report.');}finally{setBusy(false);}};
 return <div className="league-screen">
  <div className="intro-title"><span className="magic-icon"><Shield size={26}/></span><h2>{translate("Weekly league")}</h2><p>Kids compete against others their own age. Finish top of your division to climb from Bronze to Silver to Gold each week.</p></div>
  {data&&<section className="card league-theme"><span className="league-theme-emoji" aria-hidden="true">{data.theme.emoji}</span><div><strong>This week: {data.theme.title}</strong><p>{data.theme.blurb}</p></div></section>}
  {loading&&!data&&<p role="status" className="caption">Loading the league…</p>}
  {loadError&&<div className="card"><p role="alert" className="form-error">{loadError}</p><button className="text-button" onClick={()=>void refresh()}><RefreshCw size={15}/> Try again</button></div>}
  {note&&<p className="safety-note" role="status"><ShieldOff size={15}/>{note}</p>}
  {reportFor&&<div className="card league-report">
   <h3><Flag size={17}/> Report {reportFor.name}</h3>
   <p className="caption">Reporting also blocks this profile straight away, so you will not see them again. Tell us what is wrong:</p>
   <div className="league-report-reasons">{REPORT_REASONS.map(r=><button key={r} className={reportFor.reason===r?'active':''} onClick={()=>setReportFor(v=>({...v!,reason:r}))}>{REPORT_REASON_LABELS[r]}</button>)}</div>
   <div className="league-report-actions"><button className="button" disabled={busy} onClick={()=>void submitReport()}>Report and block</button><button className="text-button" onClick={()=>setReportFor(null)}>{translate("Cancel")}</button></div>
  </div>}
  {data&&!data.leagues.length&&!loadError&&<section className="card"><p className="caption">{parent?'No children have joined yet. Once a child has consent you can turn on public leagues for them.':'Earn XP this week, then ask a parent to turn on public leagues.'}</p></section>}
  {data&&data.leagues.map(g=><LeagueSection key={g.childId} g={g} showName={parent&&data.leagues.length>1} busy={busy} onEnable={enable} onReact={react} onReport={(id,name)=>setReportFor({id,name,reason:'name'})}/>)}
  {data&&data.leagues.length>0&&<p className="caption leaderboard-note">Divisions promote the top and relegate the bottom every Monday. XP is capped at 300 per day to keep it fair, and only nicknames are ever shown.</p>}
 </div>;
}
