import {useEffect,useState} from 'react';
import {Trophy,Medal,RefreshCw} from 'lucide-react';
import {api,type LeaderboardResponse,type LeaderboardEntry} from './api';

const BAND_LABEL:Record<LeaderboardEntry['ageBand'],string>={little:'Little (6–9)',junior:'Junior (10–12)',teen:'Teen (13–16)'};
const rankMedal=(i:number)=>i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;

function Board({title,subtitle,entries,highlightId}:{title:string;subtitle:string;entries:LeaderboardEntry[];highlightId?:string}){
 return <section className="card leaderboard-board">
  <div className="section-heading"><h3>{title}</h3><span>{subtitle}</span></div>
  {entries.length?<ol className="leaderboard-list">{entries.map((e,i)=><li key={e.id} className={`leaderboard-row${e.id===highlightId?' me':''}${i<3?' podium':''}`}>
   <span className="leaderboard-rank" aria-label={`Rank ${i+1}`}>{rankMedal(i)}</span>
   {e.avatar_data?<img className="leaderboard-avatar" src={e.avatar_data} alt=""/>:<span className="leaderboard-avatar placeholder" aria-hidden="true">🧒</span>}
   <div className="leaderboard-name"><strong>{e.display_name}</strong><small>{BAND_LABEL[e.ageBand]}</small></div>
   <span className="leaderboard-xp">{e.xp.toLocaleString()} XP</span>
  </li>)}</ol>:<p className="caption">No XP earned yet. Finish and approve a mission to climb the board!</p>}
 </section>;
}

export default function OnlineLeaderboard({selfId}:{selfId?:string}){
 const [data,setData]=useState<LeaderboardResponse|null>(null),[loadError,setLoadError]=useState(''),[loading,setLoading]=useState(true);
 const refresh=()=>api.leaderboard().then(result=>{setData(result);setLoadError('');}).catch(e=>setLoadError(e instanceof Error?e.message:'Could not load the leaderboard.')).finally(()=>setLoading(false));
 useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),15000);return()=>clearInterval(timer);},[]);
 return <div className="leaderboard-screen">
  <div className="intro-title"><span className="magic-icon"><Trophy size={26}/></span><h2>Family leaderboard</h2><p>XP is the same for every family, so it is a fair race. Coins stay a family treat.</p></div>
  {loading&&!data&&<p role="status" className="caption">Loading the standings…</p>}
  {loadError&&<div className="card"><p role="alert" className="form-error">{loadError}</p><button className="text-button" onClick={()=>void refresh()}><RefreshCw size={15}/> Try again</button></div>}
  {data&&<>
   <Board title="This week" subtitle={data.week} entries={data.weekly} highlightId={selfId}/>
   <Board title="All time" subtitle="Total XP earned" entries={data.allTime} highlightId={selfId}/>
   <p className="caption leaderboard-note"><Medal size={14}/> Weekly standings reset every Monday. XP is capped at 300 per day to keep it fair.</p>
  </>}
 </div>;
}
