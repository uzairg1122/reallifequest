import {useState} from 'react';
import {Check,Plus,Search} from 'lucide-react';
import {PRESETS} from './presets';
import {categories} from './state';
import './parent-task-cards.css';

export default function ParentPresetCards({search,selected,busy,onToggle,onCategoryChange}:{search:string;selected:string[];busy:boolean;onToggle:(id:string)=>void;onCategoryChange:()=>void}) {
 const groups=[...categories,{name:'Bonus',icon:'💛',color:'sun'}];
 const [category,setCategory]=useState(groups[0].name);
 const group=groups.find(g=>g.name===category)!;
 const query=search.trim().toLowerCase();
 const shown=PRESETS.filter(p=>query?(p.name+' '+p.category).toLowerCase().includes(query):p.category===category);
 const selectedHere=shown.filter(p=>selected.includes(p.id)).length;
 return <div className="parent-preset-cards">
  <div className="parent-category-tabs" role="group" aria-label="Task categories">{groups.map(g=><button key={g.name} type="button" disabled={busy} aria-pressed={!query&&category===g.name} onClick={()=>{setCategory(g.name);onCategoryChange();}}><span aria-hidden="true">{g.icon}</span>{g.name}</button>)}</div>
  <div className={`parent-routine-heading ${query?'school':group.color}`}><span className="parent-category-icon" aria-hidden="true">{query?<Search size={32}/>:group.icon}</span><div><h3>{query?'Search results':category}</h3><p>{selectedHere}/{shown.length} selected</p></div></div>
  <p className="parent-selection-hint">Tap a task to select it for your child.</p>
  <div className="parent-preset-list">{shown.map(p=>{
   const checked=selected.includes(p.id);
   return <label key={p.id} className={`parent-preset-card ${checked?'is-selected':''} ${busy?'is-busy':''}`}>
    <input type="checkbox" disabled={busy} checked={checked} onChange={()=>onToggle(p.id)} aria-label={p.name}/>
    <span className="parent-task-icon" aria-hidden="true">{p.icon}</span>
    <span className="parent-task-copy"><strong>{p.name}</strong><span className="parent-task-meta">{checked?'Selected · ':''}+{p.xp} XP</span><span className="parent-task-coins">🪙 +{p.coins} coins</span></span>
    <span className="parent-task-indicator" aria-hidden="true">{checked?<Check size={18}/>:<Plus size={18}/>}</span>
   </label>;
  })}</div>
  {!shown.length&&<p className="parent-task-empty">No matching tasks. Try another name or routine.</p>}
 </div>;
}
