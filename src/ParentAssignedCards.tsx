import {photoModeLabel} from './proof';
import {Check,Clock,ChevronRight,RotateCcw} from 'lucide-react';
import type {ApiTask} from './api';
import {taskIcon} from './taskIcons';

export default function ParentAssignedCards({tasks}:{tasks:ApiTask[]}){
 if(!tasks.length)return <p className="parent-task-empty">Assigned tasks will appear here with their progress.</p>;
 return <>{[...new Set(tasks.map(t=>t.category||'Custom Missions'))].map(category=><section className="parent-assigned-group" key={category}>
  <h4>{category}</h4><div className="parent-assigned-list">{tasks.filter(t=>(t.category||'Custom Missions')===category).map(t=>
   <div className={`parent-assigned-card ${t.status==='approved'?'is-completed':t.status==='submitted'?'is-waiting':t.status==='rejected'?'is-touchup':''}`} key={t.id}>
    <span className="parent-task-icon">{taskIcon(t.title,t.icon,t.mission_title)}</span><div className="parent-task-copy"><strong>{t.mission_title}</strong><span className="parent-task-meta">{t.status==='submitted'?'Waiting for your review':t.status==='approved'?'Completed ✓':t.status==='rejected'?'Needs another try':`+${t.xp} XP · Assigned`}</span><span className="parent-task-coins">🪙 +{t.coins} coins</span><span className="proof-policy-badge">{photoModeLabel(t.photo_mode||(Number(t.photo_required)?'required':'optional'))}</span></div>
    <span className="parent-task-indicator" aria-hidden="true">{t.status==='approved'?<Check size={17}/>:t.status==='submitted'?<Clock size={17}/>:t.status==='rejected'?<RotateCcw size={17}/>:<ChevronRight size={17}/>}</span>
   </div>)}</div>
 </section>)}</>;
}
