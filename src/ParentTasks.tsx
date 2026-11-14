import {useAppText} from './parentLanguage';
import PhotoRequirement from './PhotoRequirement';
import type {PhotoMode} from './proof';
import ParentPresetCards from './ParentPresetCards';
import ParentAssignedCards from './ParentAssignedCards';
import {useEffect,useState, type FormEvent} from 'react';
import {taskIcon,TASK_ICONS} from './taskIcons';
import {PRESETS} from './presets';
import {api,type ApiMember,type ApiTask,type RecurringMission,type RepeatFrequency} from './api';

export default function ParentTasks({members,onAssigned}:{members:ApiMember[];onAssigned:()=>void}) {
 const translate=useAppText();
 const children=members.filter(m=>m.role==='child');
 const [childId,setChildId]=useState(''),[search,setSearch]=useState(''),[selected,setSelected]=useState<string[]>([]),[custom,setCustom]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [proofMode,setProofMode]=useState<PhotoMode>('optional');
 const [difficulty,setDifficulty]=useState<'custom'|'easy'|'medium'|'hard'>('custom');
 const [customTitle,setCustomTitle]=useState(''),[customIcon,setCustomIcon]=useState('');
 const recipient=children.some(c=>c.id===childId)?childId:children[0]?.id||'';
 const [assigned,setAssigned]=useState<ApiTask[]>([]),[listError,setListError]=useState('');
 const [repeat,setRepeat]=useState<'once'|RepeatFrequency>('once');
 const [rules,setRules]=useState<RecurringMission[]>([]);
 const refreshRules=()=>api.recurringMissions().then(result=>setRules(result.rules||[]));
 useEffect(()=>{void refreshRules().catch(()=>{});},[members]);
 async function stopRule(id:string){
  setBusy(true);
  try {await api.stopRecurringMission(id);await refreshRules();setMessage('Schedule stopped.');}
  catch(error){setMessage(error instanceof Error?error.message:'Could not stop the schedule.');}
  finally{setBusy(false);}
 }
 const refresh=()=>api.tasks().then(r=>{setAssigned(r.tasks||[]);setListError('');}).catch(e=>setListError(e.message));
 useEffect(()=>{void refresh();},[members]);
 async function assign(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();if(busy||!recipient)return;
  const form=new FormData(e.currentTarget);
  const XP_BY_DIFFICULTY={easy:10,medium:25,hard:50} as const;
  const customXp=difficulty==='custom'?Number(form.get('xp')):XP_BY_DIFFICULTY[difficulty];
  const tasks=custom?[{title:String(form.get('title')).trim(),description:String(form.get('description')).trim(),coins:Number(form.get('coins')),xp:customXp,difficulty:difficulty==='custom'?undefined:difficulty,category:String(form.get('category')),icon:customIcon||taskIcon(customTitle),days:'both',photoRequired:proofMode!=='optional',photoMode:proofMode}]:PRESETS.filter(p=>selected.includes(p.id)).map(p=>({id:p.id,title:p.name,description:p.description,coins:p.coins,xp:p.xp,category:p.category,icon:p.icon,days:p.days,photoRequired:proofMode!=='optional',photoMode:proofMode}));
  if(!tasks.length)return;
  setBusy(true);setMessage('');let count=0;
  try {
   for(const task of tasks){const mission={childId:recipient,...task,missionTitle:task.title};
    if(repeat==='once')await api.assignTask(mission);
    else await api.scheduleMission({childId:recipient,task:mission,frequency:repeat,time:String(form.get('repeatTime')),weekday:Number(form.get('repeatDay')),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone});count++;if('id' in task)setSelected(ids=>ids.filter(id=>id!==task.id));}
   if(repeat!=='once'){await refreshRules();setMessage(count+' recurring mission schedule(s) saved.');return;}
   await refresh();setMessage(`${count} mission${count===1?'':'s'} assigned to ${children.find(c=>c.id===recipient)?.display_name}. They appear in the matching routine and Quests on the child’s device.`);onAssigned();
  } catch(error){setMessage(`${count?`${count} assigned. Remaining tasks were not sent. `:''}${error instanceof Error?error.message:'Assignment failed. Please try again.'}`);}
  finally{setBusy(false);}
 }
 return <section className="card parent-task-board"><h2>{translate("Assign missions")}</h2><p>{translate("Choose ready-made tasks or create your own.")}</p>{!children.length?<p>Invite a child first. Once they join, you can assign missions here.</p>:<form onSubmit={assign}>
 <label>Assign to<select aria-label="Assign to" value={recipient} disabled={busy} onChange={e=>setChildId(e.target.value)}>{children.map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></label>
 <div className="pills"><button type="button" disabled={busy} className={!custom?'active':''} onClick={()=>{setCustom(false);setMessage('')}}>Task presets</button><button type="button" disabled={busy} className={custom?'active':''} onClick={()=>{setCustom(true);setMessage('')}}>Custom task</button></div>
 {custom?<><label>Task name<input name="title" required maxLength={70} value={customTitle} onChange={e=>setCustomTitle(e.target.value)}/></label><fieldset className="task-icon-options"><legend>Task icon · {customIcon||taskIcon(customTitle)}</legend>{TASK_ICONS.map(icon=><button type="button" key={icon} aria-label={`Use ${icon} icon`} aria-pressed={(customIcon||taskIcon(customTitle))===icon} onClick={()=>setCustomIcon(icon)}>{icon}</button>)}</fieldset><button type="button" className="task-icon-auto" onClick={()=>setCustomIcon('')}>Choose automatically from task name</button><label>Instructions<textarea name="description" required maxLength={300}/></label><label>Routine<select name="category">{['Morning Routine','School & Homework','Tidy & Order','Bedtime Wind-Down','Bonus','Custom Missions'].map(c=><option key={c}>{c}</option>)}</select></label><label>Coins<input name="coins" type="number" min="1" max="100000" required defaultValue="15"/></label><label>Difficulty (sets XP)<select name="difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value as typeof difficulty)}><option value="custom">Custom XP</option><option value="easy">Easy · 10 XP</option><option value="medium">Medium · 25 XP</option><option value="hard">Hard · 50 XP</option></select></label>{difficulty==='custom'&&<label>XP<input name="xp" type="number" min="1" max="500" required defaultValue="20"/></label>}</>:<><label>Find a task<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search all presets"/></label><ParentPresetCards onCategoryChange={()=>setSearch('')} search={search} selected={selected} busy={busy} onToggle={id=>setSelected(ids=>ids.includes(id)?ids.filter(value=>value!==id):[...ids,id])}/></>}
 <PhotoRequirement label={custom?translate("Photo proof"):'Photo proof for selected tasks'} value={proofMode} onChange={setProofMode} disabled={busy}/>
 <label>Assignment schedule<select value={repeat} onChange={e=>setRepeat(e.target.value as typeof repeat)} disabled={busy}>
  <option value="once">Assign now</option><option value="daily">Every day</option><option value="weekdays">Weekdays</option>
  <option value="weekends">Weekends</option><option value="weekly">Every week</option>
 </select></label>
 {repeat!=='once'&&<label>Local time<input name="repeatTime" type="time" defaultValue="08:00" required/></label>}
 {repeat==='weekly'&&<label>Day<select name="repeatDay">{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day,i)=><option value={i+1} key={day}>{day}</option>)}</select></label>}
 <div className="parent-assign-footer">{!custom&&<div className="parent-assign-summary"><span>{selected.length} selected across all routines</span><button type="button" disabled={busy||!selected.length} onClick={()=>setSelected([])}>Clear selection</button></div>}<button className="button" type="submit" disabled={busy||!custom&&!selected.length}>{busy?'Saving…':repeat!=='once'?'Save schedule':custom?'Assign custom task':`Assign ${selected.length} selected tasks`}</button></div>
 </form>}{message&&<p role="status">{message}</p>}{rules.some(rule=>rule.childId===recipient)&&<div className="assigned-history"><h3>Scheduled missions</h3>
 {rules.filter(rule=>rule.childId===recipient).map(rule=><div className="family-schedule-row" key={rule.id}>
  <span><strong>{rule.title}</strong><br/>Next: {new Date(rule.nextAt).toLocaleString(undefined,{timeZone:rule.timezone})} ({rule.timezone})</span>
  <button type="button" disabled={busy} className="button secondary" onClick={()=>void stopRule(rule.id)}>Stop schedule</button>
 </div>)}</div>}<div className="assigned-history"><h3>{translate("Assigned missions")}</h3>{listError&&<p role="alert">{listError}</p>}{!listError&&<ParentAssignedCards tasks={assigned.filter(t=>t.assigned_to===recipient)}/>}</div></section>;
}
