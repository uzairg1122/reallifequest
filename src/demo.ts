import {initialState,today,type Quest,type State} from './state';

// Spec §5 onboarding step 2 and §10.1: a child who installs the app first sees a fun,
// locked preview. Nothing is sent to the server and nothing is written to the family's
// real save, because a child has no consent on record until a parent links the device.
const DEMO_KEY='rlq_demo_active';
const DEMO_SAVE_KEY='rlq_demo_state_v1';

export type DemoLeaderboardRow={name:string;xp:number;isMe:boolean;avatar:string};

// Fixed sample standings. Deterministic so the preview looks the same on every device and
// in every test run, and obviously not real data.
export const DEMO_LEADERBOARD:DemoLeaderboardRow[]=[
  {name:'Nova',xp:220,isMe:false,avatar:'🦊'},
  {name:'You',xp:185,isMe:true,avatar:'🧒'},
  {name:'Pip',xp:160,isMe:false,avatar:'🐼'},
  {name:'Zara',xp:120,isMe:false,avatar:'🐨'},
  {name:'Finn',xp:95,isMe:false,avatar:'🐯'},
];

export const DEMO_BLOCK_MESSAGE='This is a demo adventure. Ask a parent to link this device to your family, then your real missions unlock.';

export function isDemoActive():boolean{try{return localStorage.getItem(DEMO_KEY)==='1';}catch{return false;}}

export function startDemo():State{
  const base=initialState();
  const quests:Quest[]=base.quests.map((q,i)=>({...q,status:i===0||i===1?'completed':i===2?'waiting':q.status}));
  const demo:State={...base,name:'Demo Hero',coins:185,xp:310,level:2,streak:3,quests,notices:[{id:'demo-welcome',title:'Demo adventure',body:DEMO_BLOCK_MESSAGE,icon:'✨',time:new Date().toISOString()}]};
  try{localStorage.setItem(DEMO_SAVE_KEY,JSON.stringify(demo));localStorage.setItem(DEMO_KEY,'1');}catch{/* storage full: the demo still works, it just will not persist */}
  return demo;
}

export function loadDemoState():State{
  try{const raw=localStorage.getItem(DEMO_SAVE_KEY);if(raw)return JSON.parse(raw) as State;}catch{/* fall through to a fresh demo */}
  return startDemo();
}

export function exitDemo():void{
  try{localStorage.removeItem(DEMO_KEY);localStorage.removeItem(DEMO_SAVE_KEY);}catch{/* nothing to clean up */}
}

// Lets a child replay the sample data without unlocking anything: the preview can be
// explored freely, it just resets instead of persisting progress.
export function resetDemo():State{
  try{localStorage.removeItem(DEMO_SAVE_KEY);}catch{/* nothing to clean up */}
  return startDemo();
}

export const demoDay=()=>today();
