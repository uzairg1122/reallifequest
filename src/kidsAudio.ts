// Original, gentle in-app feedback. No remote audio, speech, applause or navigation noise.
export type KidsFeedback='submit'|'approve'|'reward'|'tap';
let context:AudioContext|null=null;
let unlocked=false;
let pending:KidsFeedback|undefined;
const active=new Map<OscillatorNode,GainNode>();
export function unlockKidsAudio(){
 if(typeof window==='undefined')return;
 try{const Audio=window.AudioContext||(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Audio)return;context??=new Audio();unlocked=true;if(context.state==='suspended')void context.resume().catch(()=>{});}catch{/* Audio must not block a mission. */}
}
export function stopKidsAudio(){
 pending=undefined;
 for(const [source,gain] of active){try{source.stop();}catch{/* Already stopped. */}source.onended=null;source.disconnect();gain.disconnect();}
 active.clear();
}
export function playKidsFeedback(enabled:boolean,kind:KidsFeedback){
 if(!enabled||(typeof document!=='undefined'&&document.hidden)){stopKidsAudio();return;}
 if(kind==='tap'||!unlocked||!context||context.state!=='running')return;
 stopKidsAudio();
 try{
  const notes=kind==='submit'?[659,880]:kind==='reward'?[659,831,988]:[523,659,784];
  notes.forEach((frequency,index)=>{
   const audio=context!,start=audio.currentTime+.015+index*.12,source=audio.createOscillator(),gain=audio.createGain();
   source.type='sine';source.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.045,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+.32);source.connect(gain);gain.connect(audio.destination);active.set(source,gain);
   source.onended=()=>{source.disconnect();gain.disconnect();active.delete(source);};source.start(start);source.stop(start+.34);
  });
 }catch{stopKidsAudio();}
}
export function playKidsFeedbackAfterResume(enabled:boolean,kind:KidsFeedback){
 if(!enabled||(typeof document!=='undefined'&&document.hidden)){stopKidsAudio();return;}
 if(!unlocked||!context)return;
 if(context.state==='running'){playKidsFeedback(enabled,kind);return;}
 if(context.state!=='suspended')return;
 pending=kind;void context.resume().then(()=>{const next=pending;pending=undefined;if(next&&context?.state==='running')playKidsFeedback(enabled,next);}).catch(()=>{pending=undefined;});
}
