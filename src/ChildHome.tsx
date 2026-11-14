import {useAppText} from './parentLanguage';
import {RefreshCw,ChevronRight} from 'lucide-react';
import {categories,type Quest} from './state';

type Props={name:string;quests:Quest[];streak:number;online:boolean;onRoutine:(name:string)=>void;onQuests:()=>void;onRefresh:()=>void;error:string};
export default function ChildHome({name,quests,streak,online,onRoutine,onQuests,onRefresh,error}:Props){
 const translate=useAppText();
 const routines=quests.filter(q=>q.category!=='Bonus');
 const done=routines.filter(q=>q.status==='completed').length;
 const waiting=quests.filter(q=>q.status==='waiting').length;
 const nextRoutine=routines.find(q=>q.status==='active'||q.status==='touchup');
 const groups=[...categories,...(quests.some(q=>q.category==='Custom Missions')?[{name:'Custom Missions',icon:'⚔️',color:'school'}]:[])];
 return <div className="kid-home reference-home">
  <h1 className="sr-only">Let’s go, {name}!</h1>
  <section className="kid-adventure-banner">
   <h2>{translate("Today’s adventure")}</h2>
   <p>{done}/{routines.length} {translate("missions done")}</p>
   <button className="button" onClick={()=>nextRoutine?onRoutine(nextRoutine.category):onQuests()}>{translate(nextRoutine?"Continue quest":"All my missions")}<ChevronRight size={16}/></button>
  </section>
  <section className="streak-card">
   <span className="big-emoji" aria-hidden="true">🔥</span>
   <div><h3>{online?translate("Your little wins"):`${streak} Day Streak`}</h3><small>{online?'Keep it up! Every mission counts.':streak?'Keep it up!':'Start your streak today!'}</small></div>
   <div className="streak-flames" aria-hidden="true">{Array.from({length:5},(_,i)=><span key={i} className={(online?done:streak)>i?'lit':''}>🔥</span>)}</div>
  </section>
  <h2 className="kid-routine-title">{translate("Your routines")}</h2>
  <div className="routine-grid">{groups.map(c=>{const tasks=routines.filter(q=>q.category===c.name);const complete=tasks.filter(q=>q.status==='completed').length;return <button className={`routine-card ${c.color}`} onClick={()=>onRoutine(c.name)} key={c.name}>
   <span className="routine-emoji" aria-hidden="true">{c.name==='Custom Missions'?c.icon:null}</span><div><h3>{translate(c.name)}</h3><small>{tasks.length?`${complete}/${tasks.length} ${translate("completed")}`:translate("Ready for missions")}</small>{tasks.length>0&&<div className="routine-mini-progress" aria-hidden="true"><i style={{width:`${complete/tasks.length*100}%`}}/></div>}</div>
  </button>;})}</div>
  {error&&<p role="alert" className="form-error">{error}</p>}
  {waiting>0&&<button className="kid-pending" onClick={onQuests}><span>⏳</span><span>{waiting} {waiting===1?'mission':'missions'} waiting for your parent</span><ChevronRight size={17}/></button>}
  {!quests.length&&<p className="caption">Your parent can send your first missions. They’ll appear here!</p>}
  <div className="home-actions"><button className="text-button" onClick={onQuests}>{translate("All my missions")}<ChevronRight size={15}/></button>{online&&<button className="text-button" onClick={onRefresh}><RefreshCw size={14}/> {translate("Refresh tasks")}</button>}</div>
 </div>;
}
