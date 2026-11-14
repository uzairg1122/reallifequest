import closedChest from '../assets/kid-redesign/celebration/chest-closed.png';
import openChest from '../assets/kid-redesign/rewards/treasure-chest.png';
import applause from '../assets/kid-redesign/celebration/mission-applause.mp3';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowRight,Check,Coins,Gift,ShieldCheck,Star,X} from 'lucide-react';
import type {ApiNotification} from './api';
import './reward-celebration.css';

const confettiColors = ['#ffcb35', '#43c956', '#238fff', '#ff548d', '#f24b40'];

export default function RewardCelebration({notification,onClose,sound,exiting=false}:{sound:boolean;exiting?:boolean;notification:ApiNotification;onClose:()=>void}) {
 const [opened,setOpened]=useState(false);
 const audio=useRef<HTMLAudioElement>(null);
 const revealed=useRef(false);
 const panel=useRef<HTMLElement>(null),close=useRef(onClose);close.current=onClose;
 const isMission=notification.type==='task_approved';
 const earned=isMission?notification.body.match(/\+(\d+) coins and \+(\d+) XP/):null;
 useEffect(()=>{
  const artwork=new Image();artwork.src=openChest;
  const previous=document.activeElement as HTMLElement|null;
  panel.current?.querySelector<HTMLButtonElement>('.treasure-scene')?.focus();
  const key=(event:KeyboardEvent)=>{
   if(event.key==='Escape'){event.preventDefault();close.current();}
   if(event.key==='Tab'){
    const buttons=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])')||[]);
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);previous?.focus();};
 },[]);
 useEffect(()=>{
  const player=audio.current;
  if(exiting||!sound)player?.pause();
  return ()=>player?.pause();
 },[exiting,sound]);
 function reveal(){
  if(revealed.current||exiting)return;
  revealed.current=true;
  setOpened(true);
  if(sound)void audio.current?.play().catch(()=>{});
 }
 return <div className={`modal-backdrop loot-backdrop${exiting?' is-exiting':''}`} inert={exiting}><section ref={panel} className={`loot-card ${opened?'loot-open':''}`} role="dialog" aria-modal="true" aria-label="Mission approved" aria-describedby="loot-description">
  <audio ref={audio} src={applause} preload="auto"/> 
  <button type="button" className="loot-close" aria-label="Close celebration" onClick={onClose}><X size={19}/></button>
  <div className="loot-approved"><ShieldCheck size={14}/> PARENT APPROVED</div>
  <header className="loot-heading"><h1>{opened?'Hooray! You did it!':isMission?'Mission complete!':'Reward unlocked!'}</h1><p id="loot-description">{isMission?'Your parent approved your mission. High five, hero!':'Your special reward is ready. Time to celebrate!'}</p></header>
  <button type="button" className="treasure-scene" onClick={reveal} aria-label={opened?'Rewards revealed':'Reveal my rewards'} aria-expanded={opened}>
   <img className="treasure-art" src={opened?openChest:closedChest} alt={opened?'A blue and gold treasure chest bursting with colourful gifts, coins and stars':'A blue and gold treasure chest waiting to be opened'}/>
   {!opened&&<div className="loot-sparkles" aria-hidden="true">{Array.from({length:12},(_,i)=><i key={i} style={{left:`${8+(i*23)%86}%`,top:`${12+(i*17)%70}%`,animationDelay:`${i*.19}s`}}>✦</i>)}</div>}
  </button>
  <div className="loot-content" aria-live="polite">
   {opened?<>
    {earned?<div className="loot-rewards"><div className="loot-reward gold"><Coins size={26}/><div><strong>+{Number(earned[1]).toLocaleString()}</strong><span>coins</span></div></div><div className="loot-reward violet"><Star size={26}/><div><strong>+{Number(earned[2]).toLocaleString()}</strong><span>XP</span></div></div></div>:<div className="loot-reward reward-message"><Gift size={26}/><div><strong>{isMission?'Mission complete!':'Reward unlocked!'}</strong><p>{notification.body}</p></div></div>}
    <p className="loot-footnote">{isMission?<><Check size={14}/> Safely added to your adventure!</>:'Ask your parent to arrange your reward.'}</p></>:<p className="loot-unopened">{isMission?'Your rewards are safely in your vault. Tap to see your treasure!':'Tap the treasure to discover your reward!'}</p>}
   <button type="button" className="loot-continue" onClick={opened?onClose:reveal}>{opened?'Awesome! Keep going':'Reveal my rewards'}<ArrowRight size={19}/></button>
   {!opened&&<button type="button" className="loot-later" onClick={onClose}>Back to my adventures</button>}
  </div>
  {opened&&!exiting&&<div className="loot-confetti" aria-hidden="true">
   {Array.from({length:24},(_,index)=>{
    const ribbon=index%4===0;
    const left=(ribbon?index/4:index)%2===0;
    const inset=ribbon?4+index%8:3+(index*13)%22;
    const duration=2.7+(index%7)*.26;
    const style={
     left:`${left?inset:100-inset}%`,
     color:confettiColors[index%confettiColors.length],
     '--fall-time':`${duration}s`,
     '--fall-delay':`${index<6?index*.08:-duration*(index%11)/11}s`,
     '--drift':left?'20px':'-20px',
    } as CSSProperties;
    return <span key={index} className={ribbon?'loot-ribbon':'loot-paper'} style={style}/>;
   })}
  </div>}
 </section></div>;
}
