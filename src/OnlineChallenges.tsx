import {useAppText} from './parentLanguage';
import {useEffect,useState,type FormEvent} from 'react';
import {Swords,RefreshCw,Plus,LogIn,Users} from 'lucide-react';
import {api,type ChallengeList,type Challenge} from './api';

const rankMedal=(rank:number)=>rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':`#${rank}`;

function ChallengeCard({c}:{c:Challenge}){
 const active=c.week===c.currentWeek;
 return <section className="card challenge-card">
  <div className="section-heading"><h3>{c.name}</h3><span>{active?'Live this week':`Week ${c.week}`}</span></div>
  <div className="challenge-code-row"><span>Invite code</span><code className="challenge-code">{c.code}</code>{c.isOwner&&<small>Share this with another parent</small>}</div>
  {c.standings.length?<ol className="challenge-standings">{c.standings.map(s=><li key={s.familyId} className={`challenge-standing${s.isMe?' me':''}${s.rank<=3?' podium':''}`}>
   <span className="challenge-rank" aria-label={`Rank ${s.rank}`}>{rankMedal(s.rank)}</span>
   <div className="challenge-family"><strong>{s.name}{s.isMe?' (you)':''}</strong><small>{s.children} {s.children===1?'child':'children'}</small></div>
   <span className="challenge-avg">{s.avgXp.toLocaleString()} XP<small>avg / child</small></span>
  </li>)}</ol>:<p className="caption">No families are scoring yet. Approve missions to earn this week’s XP!</p>}
 </section>;
}

export default function OnlineChallenges({parent}:{parent:boolean}){
 const translate=useAppText();
 const [data,setData]=useState<ChallengeList|null>(null),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true);
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[newCode,setNewCode]=useState('');
 const refresh=()=>api.challenges().then(result=>{setData(result);setLoadError('');}).catch(e=>setLoadError(e instanceof Error?e.message:'Could not load challenges.')).finally(()=>setLoading(false));
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer);},[]);
 async function action(fn:()=>Promise<unknown>,ok:string){setBusy(true);setMessage('');try{await fn();await refresh();setMessage(ok);}catch(e){setMessage(e instanceof Error?e.message:'Something went wrong.');}finally{setBusy(false);}}
 function create(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const name=String(f.get('name')||'').trim();if(!name)return;(e.currentTarget as HTMLFormElement).reset();void action(async()=>{const r=await api.createChallenge(name);setNewCode(r.code);},'Challenge created — share the code below.');}
 function join(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);const code=String(f.get('code')||'').trim();if(!code)return;(e.currentTarget as HTMLFormElement).reset();void action(()=>api.joinChallenge(code),'Joined the challenge!');}
 return <div className="challenges-screen">
  <div className="intro-title"><span className="magic-icon"><Swords size={26}/></span><h2>{translate("Family challenges")}</h2><p>Race another family this week. Scores are the average XP per child, so family size doesn’t matter.</p></div>
  {parent&&<div className="challenge-forms">
   <form className="card" onSubmit={create}><h3><Plus size={16}/> {translate("Start a challenge")}</h3><label>{translate("Challenge name")}<input name="name" required maxLength={120} placeholder="Weekend XP showdown"/></label><button className="button" disabled={busy}>Create challenge</button>{newCode&&<p className="challenge-new-code" role="status">Share this code: <code>{newCode}</code></p>}</form>
   <form className="card" onSubmit={join}><h3><LogIn size={16}/> {translate("Join a challenge")}</h3><label>{translate("Challenge code")}<input name="code" required maxLength={8} placeholder="ABC-123" autoCapitalize="characters"/></label><button className="button secondary" disabled={busy}>Join challenge</button></form>
  </div>}
  {message&&<p role="status" className="wallet-message">{message}</p>}
  {loading&&!data&&<p role="status" className="caption">Loading challenges…</p>}
  {loadError&&<div className="card"><p role="alert" className="form-error">{loadError}</p><button className="text-button" onClick={()=>void refresh()}><RefreshCw size={15}/> Try again</button></div>}
  {data&&!data.challenges.length&&!loadError&&<section className="card challenge-empty"><span aria-hidden="true"><Users size={30}/></span><h3>{translate("No challenges yet")}</h3><p>{parent?'Start one above and share the code with another family, or join with a code you were given.':'Ask your parent to start or join a family challenge.'}</p></section>}
  {data&&data.challenges.map(c=><ChallengeCard key={c.id} c={c}/>)}
  {data&&data.challenges.length>0&&<p className="caption leaderboard-note">Standings reset every Monday. XP is capped at 300 per child per day to keep it fair.</p>}
 </div>;
}
