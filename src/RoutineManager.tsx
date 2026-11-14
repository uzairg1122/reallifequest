import {useState} from 'react';
import './presets.css';
import {Check,ChevronRight,Plus,Search,Sparkles} from 'lucide-react';
import {categories,type Quest,type State} from './state';
import {allowPresets,findPresetQuest,PACKS,PRESETS} from './presets';

type Props={
  state:State;
  initialTab:'mine'|'library';
  onChange:(update:(s:State)=>State)=>void;
  onEdit:(quest:Quest)=>void;
  onCustom:()=>void;
  onTemplates:()=>void;
  onNotify:(message:string)=>void;
};

export default function RoutineManager({state,initialTab,onChange,onEdit,onCustom,onTemplates,onNotify}:Props) {
  const [tab,setTab]=useState(initialTab);
  const [schedule,setSchedule]=useState('Weekdays');
  const [search,setSearch]=useState('');
  const [age,setAge]=useState('all');
  const [category,setCategory]=useState('All categories');
  const [kind,setKind]=useState('All tasks');
  const [selected,setSelected]=useState<string[]>([]);
  const [repeat,setRepeat]=useState('suggested');
  const [packName,setPackName]=useState('');
  const chosen=PRESETS.filter(p=>selected.includes(p.id)&&!findPresetQuest(state.quests,p)?.enabled);
  const filtered=PRESETS.filter(p=>(age!=='6-8'||p.minAge===6) &&
    (category==='All categories'||p.category===category) &&
    (kind==='All tasks'||p.kind===kind) &&
    `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle=(id:string)=>setSelected(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);
  const allow=()=>{
    onChange(s=>allowPresets(s,chosen.map(p=>p.id),repeat==='suggested'?undefined:repeat as Quest['days']));
    onNotify(`${chosen.length} ${chosen.length===1?'task':'tasks'} allowed! You can edit or pause them in My Routines.`);
    setSelected([]);setPackName('');setTab('mine');
  };
  return <div className="routine-manager">
    <div className="pills two manager-tabs" aria-label="Routine management views">
      <button className={tab==='mine'?'active':''} onClick={()=>setTab('mine')}>My Routines</button>
      <button className={tab==='library'?'active':''} onClick={()=>setTab('library')}>Preset Library</button>
    </div>
    {tab==='mine'?<>
      <div className="manager-intro"><span className="eyebrow">A LITTLE STRUCTURE. A LOT OF GROWTH.</span><h2>{state.name}’s everyday adventures</h2><p>Allowed routines appear automatically for your child on their scheduled days.</p></div>
      <div className="manager-actions"><button onClick={()=>setTab('library')}><Sparkles size={18}/> Browse Presets</button><button onClick={onCustom}><Plus size={18}/> Custom Task</button></div>
      <div className="pills two">{['Weekdays','Weekends','One-time'].map(day=><button key={day} className={schedule===day?'active':''} onClick={()=>setSchedule(day)}>{day}</button>)}</div>
      {[...categories,{name:'Bonus',icon:'💛',color:'sun'}].map(c=>{
        const items=state.quests.filter(q=>q.category===c.name&&(schedule==='One-time'?q.days==='Once':q.days==='both'||q.days===schedule));
        if(!items.length)return null;
        return <section className="card routine-control" key={c.name}>
          <div className="section-heading"><h3>{c.icon} {c.name==='Bonus'?'Family Helping Tasks':c.name}</h3><span>{items.filter(q=>q.enabled).length} allowed</span></div>
          {items.map(q=><div className="control-row" key={q.id}>
            <button onClick={()=>onEdit(q)}>{q.icon} {q.name}<small>{q.status==='completed'&&q.days==='Once'?'Completed · ':q.enabled?'Allowed · ':'Paused · '}Edit task</small></button>
            <button role="switch" aria-label={`Enable ${q.name}`} aria-checked={q.enabled} className={`toggle ${q.enabled?'on':''}`} onClick={()=>onChange(s=>({...s,quests:s.quests.map(x=>x.id===q.id?{...x,enabled:!x.enabled}:x)}))}><i/></button>
          </div>)}
        </section>;
      })}
      {!state.quests.some(q=>schedule==='One-time'?q.days==='Once':q.days==='both'||q.days===schedule)&&<div className="empty"><span>🌱</span><h3>Room for a little adventure</h3><p>Choose from the preset library or create a task just for your child.</p></div>}
      <button className="button secondary" onClick={onTemplates}><Sparkles size={18}/> Adventure Templates</button>
    </>:<>
      <section className="preset-hero"><span>🌱</span><div><span className="eyebrow">READY-MADE LITTLE WINS</span><h2>A routine that fits your child</h2><p>Start with a few tasks. Pick what fits their abilities, and help them learn each step.</p></div></section>
      <div className="section-heading"><h2>Start with a little pack</h2><span>Review, then allow</span></div>
      <div className="preset-packs">{PACKS.map(pack=>{
        const available=pack.ids.filter(id=>!findPresetQuest(state.quests,PRESETS.find(p=>p.id===id)!)?.enabled);
        return <button key={pack.id} className={`preset-pack ${packName===pack.name?'selected':''}`} disabled={!available.length} onClick={()=>{setSelected(available);setPackName(pack.name);setSearch('');setCategory('All categories');setKind('All tasks');setAge('all')}}>
          <span>{pack.icon}</span><strong>{pack.name}</strong><small>{pack.description}</small><b>{available.length?`Select ${available.length} tasks`:'Already allowed ✓'}</b>
        </button>;
      })}</div>
      <div className="section-heading"><h2>Build your own mix</h2><span>{PRESETS.length} ready-made tasks</span></div>
      <label className="preset-search"><Search size={18}/><input aria-label="Search presets" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search teeth, books, laundry…"/></label>
      <div className="preset-filters">
        <label>Age guide<select value={age} onChange={e=>setAge(e.target.value)}><option value="all">All ages · 6–12</option><option value="6-8">Ages 6–8</option><option value="9-12">Ages 9–12</option></select></label>
        <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option>All categories</option>{categories.map(c=><option key={c.name}>{c.name}</option>)}<option value="Bonus">Family Helping Tasks</option></select></label>
      </div>
      <div className="pills">{['All tasks','Daily routines','Helping tasks'].map(k=><button key={k} className={kind===k?'active':''} onClick={()=>setKind(k)}>{k}</button>)}</div>
      <p className="preset-results">{filtered.length} ideas · Age guides are flexible; adapt each task to your child.</p>
      <div className="preset-list">{filtered.map(p=>{
        const existing=findPresetQuest(state.quests,p),allowed=!!existing?.enabled,isSelected=selected.includes(p.id)&&!allowed;
        return <article className={`preset-card ${isSelected?'selected':''}`} key={p.id}>
          <div className="preset-card-top"><span className="tile-icon">{p.icon}</span><div><h3>{p.name}</h3><small>{p.minAge===9?'Ages 9–12':'Ages 6–12'} · {p.minutes}</small></div>
            <button className={`preset-check ${allowed?'allowed':''}`} aria-label={allowed?`${p.name} already allowed`:`Select ${p.name}`} aria-pressed={isSelected||allowed} disabled={allowed} onClick={()=>toggle(p.id)}>{allowed||isSelected?<Check size={19}/>:<Plus size={19}/>}</button>
          </div>
          <p>{p.description}</p>
          {p.help&&<div className="preset-help">🤝 {p.help}</div>}
          <div className="preset-card-footer"><span>{existing?existing.enabled?'Allowed ✓':'Paused · select to allow':p.days==='Once'?'One-time by default':p.days==='Weekdays'?'School weekdays':'Daily routine'}</span><span>🪙 {existing?.coins??p.coins} · {existing?.xp??p.xp} XP</span></div>
          {existing&&<button className="preset-edit" onClick={()=>onEdit(existing)}>Edit existing task <ChevronRight size={14}/></button>}
        </article>;
      })}</div>
      {!filtered.length&&<div className="empty"><span>🔎</span><h3>No matching ideas yet</h3><p>Try a different search or make your own task.</p><button className="text-button" onClick={()=>{setSearch('');setAge('all');setCategory('All categories');setKind('All tasks')}}>Clear filters</button></div>}
      <button className="button secondary preset-custom" onClick={onCustom}><Plus size={18}/> Create a Custom Task</button>
      <details className="preset-sources"><summary>How these ideas were chosen</summary><p>Inspired by guidance on everyday routines and age-appropriate responsibilities. Ages, task times and coins are editable app suggestions, not medical recommendations.</p><a href="https://health.clevelandclinic.org/age-appropriate-chores" target="_blank" rel="noreferrer">Cleveland Clinic · Chores by age</a><a href="https://www.healthychildren.org/English/healthy-living/sleep/Pages/Bedtime-Routines-for-School-Aged-Children.aspx" target="_blank" rel="noreferrer">American Academy of Pediatrics · Bedtime routines</a><a href="https://www.seattlechildrens.org/health-safety/parenting/kids-thrive-routines/" target="_blank" rel="noreferrer">Seattle Children’s · Daily routines</a><a href="https://www.mouthhealthy.org/all-topics-a-z/brushing-your-teeth" target="_blank" rel="noreferrer">American Dental Association · Toothbrushing</a></details>
      {chosen.length>0&&<div className="preset-selection" role="region" aria-label="Selected presets">
        <div className="section-heading"><h3>{chosen.length} {chosen.length===1?'task':'tasks'} selected</h3><button className="text-button" onClick={()=>{setSelected([]);setPackName('')}}>Clear</button></div>
        <details><summary>Review selected tasks{packName?` · ${packName}`:''}</summary><ul>{chosen.map(p=><li key={p.id}>{p.icon} {p.name}<button aria-label={`Remove ${p.name} from selection`} onClick={()=>toggle(p.id)}>×</button></li>)}</ul></details>
        <label>Schedule for new tasks<select value={repeat} onChange={e=>setRepeat(e.target.value)}><option value="suggested">Use each task’s suggested schedule</option><option value="both">Every day</option><option>Weekdays</option><option>Weekends</option><option value="Once">One time</option></select></label>
        <button className="button" onClick={allow}><Check size={18}/> Allow {chosen.length} {chosen.length===1?'Task':'Tasks'}</button>
        <small>Existing tasks keep their schedule and progress. No duplicates.</small>
      </div>}
    </>}
  </div>;
}
