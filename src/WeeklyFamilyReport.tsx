import {useEffect,useState} from 'react';
import {api} from './api';

export default function WeeklyFamilyReport(){
 const [week,setWeek]=useState<'current'|'previous'>('current');
 const [report,setReport]=useState<Awaited<ReturnType<typeof api.weeklyReport>>>();
 const [message,setMessage]=useState('');
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  if(!open)return;
  let current=true;
  setReport(undefined);setMessage('');
  api.weeklyReport(week).then(result=>{if(current)setReport(result);}).catch(error=>{if(current)setMessage(error.message);});
  return ()=>{current=false;};
 },[week,open]);
 return <details className="card family-weekly-report" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>Weekly family report</summary>
  <label>Week<select value={week} onChange={e=>setWeek(e.target.value==='previous'?'previous':'current')}>
   <option value="current">This week</option><option value="previous">Last week</option>
  </select></label>
  {!report&&<p role="status">{message||'Loading family progress…'}</p>}
  {report?.children.length===0&&<p>Invite a child to start tracking family progress.</p>}
  <ul>{report?.children.map(child=><li key={child.id}><strong>{child.display_name}</strong><span>{child.approved} approved · {child.xp} XP · {child.coins} coins</span></li>)}</ul>
 </details>;
}
