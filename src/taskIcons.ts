import {PRESETS} from './presets';

export const TASK_ICONS = ['🪥','🫧','👕','🛏️','🪮','🥣','🎒','💧','📝','📗','✏️','📋','🧸','🧺','👟','📚','🌙','📖','👚','📵','🍽️','🥄','🪴','🧦','🧽','♻️','🧩','🧹','🥪','🛒','🐾','🎨','🎵','🚲','⚽','💛','⭐','🎯'];
const normalize=(name:string)=>name.trim().toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ');
const rules:Array<[RegExp,string]> = [
 [/teeth|tooth|brush.*bed/,'🪥'],[/story/,'📖'],[/pyjama|pajama/,'🌙'],[/bed|blanket|pillow/,'🛏️'],
 [/wash|hands|face/,'🫧'],[/hair|comb/,'🪮'],[/breakfast/,'🥣'],[/water.*bottle|bottle/,'💧'],[/backpack|school bag|pack.*bag/,'🎒'],
 [/homework|math|worksheet/,'📝'],[/read/,'📗'],[/book|shelf/,'📚'],[/desk|study space|pencil/,'✏️'],[/school list|timetable/,'📋'],
 [/toy/,'🧸'],[/sock/,'🧦'],[/laundry|hamper|towel/,'🧺'],[/shoe/,'👟'],[/clothes|dress/,'👕'],[/screen|tablet|phone/,'📵'],
 [/clear.*table|clear.*place/,'🥄'],[/wipe|cloth/,'🧽'],[/table|dinner/,'🍽️'],[/plant|garden/,'🪴'],[/recycl|bin/,'♻️'],
 [/puzzle/,'🧩'],[/clean|room|sweep|floor|tidy|mess/,'🧹'],[/lunch|sandwich/,'🥪'],[/grocer|shopping/,'🛒'],[/pet|dog|cat/,'🐾'],
 [/draw|paint|art/,'🎨'],[/music|piano|sing/,'🎵'],[/bik|cycl/,'🚲'],[/sport|football|soccer/,'⚽'],[/help|kind/,'💛']
];

/** Repair legacy generic icons at display time, without changing saved tasks/progress. */
export function taskIcon(title:string, stored?:string, missionTitle?:string):string {
 const icon=stored?.trim();
 if(icon&&!['⚔️','⚔','✨',''].includes(icon))return icon;
 const names=[title,missionTitle||''].map(normalize);
 const preset=PRESETS.find(p=>names.includes(normalize(p.name)));
 if(preset)return preset.icon;
 const text=names.join(' ');
 return rules.find(([pattern])=>pattern.test(text))?.[1]||'🎯';
}
