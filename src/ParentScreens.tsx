import {useEffect,useState,type ReactNode} from 'react';
import {api,type ApiMember,type ApiTask} from './api';
import sunrise from '../assets/parent-redesign/sunrise-header.png';
import insights from '../assets/parent-redesign/new-screens/insights.png';
import tasks from '../assets/parent-redesign/new-screens/tasks.png';
import family from '../assets/parent-redesign/new-screens/family-members.png';
import assign from '../assets/parent-redesign/new-screens/assign-mission.png';
import bed from '../assets/parent-redesign/new-screens/task-icons/bed.png';
import bin from '../assets/parent-redesign/new-screens/task-icons/dustbin.png';
import books from '../assets/parent-redesign/new-screens/task-icons/books.png';
import CoParentManager from './CoParentManager';
import './parent-screens.css';

const artwork={Insights:insights,Tasks:tasks,'Family Members':family,'Assign Mission':assign};
export function ParentScreenHeader({title}:{title:keyof typeof artwork}){
 return <header className="parent-screen-banner" style={{backgroundImage:`url("${sunrise}")`}}><h1>{title}</h1><img src={artwork[title]} alt=""/></header>;
}

type Period='weekly'|'monthly'|'yearly';
type Metric='approved'|'xp'|'coins';
export function ParentInsights({members}:{members:ApiMember[]}){
 const [period,setPeriod]=useState<Period>('weekly'),[child,setChild]=useState(''),[metric,setMetric]=useState<Metric>('approved');
 const [data,setData]=useState<Awaited<ReturnType<typeof api.insights>>>(),[error,setError]=useState('');
 useEffect(()=>{
  let active=true;
  setData(undefined);setError('');
  api.insights(period,child).then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e.message);});
  return ()=>{active=false;};
 },[period,child]);
 const start=new Date((data?.start??'2000-01-01')+'T00:00:00Z');
 const count=period==='weekly'?7:period==='monthly'?Math.ceil(new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate()/7):12;
 const values=Array<number>(count).fill(0);
 for(const row of metric==='approved'?data?.approved??[]:data?.earned??[]){
  const date=new Date(row.day+'T00:00:00Z');
  const i=period==='weekly'?Math.round((date.getTime()-start.getTime())/86400000):period==='monthly'?Math.floor((date.getUTCDate()-1)/7):date.getUTCMonth();
  if(i>=0&&i<count)values[i]+=Number('approved' in row?row.approved:metric==='approved'?0:row[metric])||0;
 }
 const max=Math.max(1,...values);
 return <div className="parent-new-stack"><ParentScreenHeader title="Insights"/>
  <div className="pills">{(['weekly','monthly','yearly'] as const).map(p=><button key={p} className={p===period?'active':''} aria-pressed={p===period} onClick={()=>setPeriod(p)}>{p[0].toUpperCase()+p.slice(1)}</button>)}</div>
  <select aria-label="Child filter" value={child} onChange={e=>setChild(e.target.value)}><option value="">All children</option>{members.filter(m=>m.role==='child').map(m=><option key={m.id} value={m.id}>{m.display_name}</option>)}</select>
  <section className="card"><label>Metric<select value={metric} onChange={e=>setMetric(e.target.value as Metric)}><option value="approved">Approved missions</option><option value="xp">XP earned</option><option value="coins">Coins earned</option></select></label>
  {error?<p role="alert">{error}</p>:data?<><strong>{values.reduce((sum,n)=>sum+n,0)} total</strong><div className="parent-bars" style={{gridTemplateColumns:`repeat(${count},minmax(0,1fr))`}}>{values.map((value,i)=>{
   const label=period==='weekly'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]:period==='monthly'?`W${i+1}`:new Intl.DateTimeFormat(undefined,{month:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2000,i,1)));
   return <div key={i} aria-label={`${label}: ${value}`}><span>{value}</span><i style={{height:`${Math.max(2,100*value/max)}px`}}/><small>{label}</small></div>;
  })}</div></>:<p role="status">Loading report…</p>}</section>
  {data&&period==='weekly'&&<section className="card"><h2>Active days</h2><div className="parent-week-strip">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,i)=>{
   const date=new Date(start.getTime()+i*86400000).toISOString().slice(0,10);
   const active=data.approved.some(row=>row.day===date&&Number(row.approved)>0);
   return <span key={day}>{active?'★':'○'}<small>{day}</small></span>;
  })}</div></section>}
 </div>;
}

function localDay(date:Date){
 return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
export function missionDeadline(due?:string|null){
 return due?new Date(due.replace(' ','T')+'Z'):null;
}
export function ParentTaskScreen({rewards,history,onAssign,onReview,onHistory}:{rewards:ReactNode;history:ReactNode;onAssign:()=>void;onReview:()=>void;onHistory:()=>void}){
 const [tab,setTab]=useState('Today'),[day,setDay]=useState(()=>localDay(new Date()));
 const [rows,setRows]=useState<ApiTask[]>([]),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 useEffect(()=>{
  let active=true;
  api.tasks().then(result=>{if(active){setRows(result.tasks);setLoaded(true);}}).catch(e=>{if(active)setError(e.message);});
  return ()=>{active=false;};
 },[]);
 const start=new Date(day+'T12:00:00');start.setDate(start.getDate()-(start.getDay()+6)%7);
 const shown=rows.filter(row=>row.created_at&&localDay(new Date(row.created_at.replace(' ','T')+'Z'))===day);
 return <div className="parent-new-stack"><ParentScreenHeader title="Tasks"/>
  <div className="pills">{['Today','Rewards','History'].map(t=><button className={t===tab?'active':''} aria-pressed={t===tab} key={t} onClick={()=>{setTab(t);if(t==='History')onHistory();}}>{t}</button>)}</div>
  {tab==='Rewards'?rewards:tab==='History'?history:<>
   <label>Assignment date<input type="date" value={day} onChange={e=>{if(e.target.value)setDay(e.target.value);}}/></label>
   <div className="parent-week-strip">{Array.from({length:7},(_,i)=>{
    const date=new Date(start);date.setDate(start.getDate()+i);const value=localDay(date);
    return <button type="button" key={value} className={value===day?'active':''} aria-pressed={value===day} onClick={()=>setDay(value)}><small>{date.toLocaleDateString(undefined,{weekday:'short'})}</small>{date.getDate()}</button>;
   })}</div>
   <div className="parent-task-links"><button className="button" onClick={onAssign}>Assign mission</button><button className="button secondary" onClick={onReview}>Review submissions</button></div>
   {error?<p role="alert">{error}</p>:!loaded?<p role="status">Loading assignments…</p>:shown.length===0?<p>No missions assigned on this date.</p>:shown.map(task=>{
    const title=task.mission_title||task.title;
    const icon=/bed|tidy.*room/i.test(title)?bed:/trash|rubbish|garbage|bin/i.test(title)?bin:/read|book/i.test(title)?books:null;
    const due=missionDeadline(task.due_at);
    const status=task.status==='approved'?'Approved':task.status==='submitted'?'In review':due&&due.getTime()<Date.now()?'Late':task.status==='rejected'?'Try again':'Assigned';
    return <article className="card parent-task-row" key={task.id}>{icon?<img src={icon} alt=""/>:<span aria-hidden="true">{task.icon||'📋'}</span>}<div><strong>{title}</strong><small>{task.child_name}{task.assigner_name?' · Assigned by '+task.assigner_name:''}{due?` · Due ${due.toLocaleString()}`:''}</small></div><b data-status={status}>{status}</b></article>;
   })}
  </>}
 </div>;
}

export function ParentFamilyMembers({members}:{members:ApiMember[]}){
 return <div className="parent-new-stack"><ParentScreenHeader title="Family Members"/><CoParentManager/><section className="card"><h2>Kids</h2>{members.filter(m=>m.role==='child').map(m=><div className="parent-member-row" key={m.id}><span>{m.display_name[0]}</span><div><strong>{m.display_name}</strong><small>Level {m.level} · {m.xp} XP</small></div></div>)}</section></div>;
}
