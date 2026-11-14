import {beforeEach,afterEach,it,expect,vi} from 'vitest';
let audio:typeof import('./kidsAudio');
const parameter=()=>({value:0,setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn()});
let nodes:Array<{stop:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>;start:ReturnType<typeof vi.fn>;frequency:ReturnType<typeof parameter>;connect:ReturnType<typeof vi.fn>;onended:(()=>void)|null;type:string}>;
let context:FakeAudio;
let startState:'running'|'suspended';
class FakeAudio{
 state=startState;currentTime=3;destination={};resume=vi.fn(async()=>{});
 constructor(){context=this;}
 createOscillator(){const n={stop:vi.fn(),disconnect:vi.fn(),start:vi.fn(),frequency:parameter(),connect:vi.fn(),onended:null as (()=>void)|null,type:'sine'};nodes.push(n);return n;}
 createGain(){return{gain:parameter(),connect:vi.fn(),disconnect:vi.fn()};}
}
beforeEach(async()=>{vi.resetModules();nodes=[];startState='running';vi.stubGlobal('window',{AudioContext:FakeAudio,speechSynthesis:{speak:vi.fn()}});vi.stubGlobal('document',{hidden:false});audio=await import('./kidsAudio');});
afterEach(()=>{audio.stopKidsAudio();vi.unstubAllGlobals();});
it('stays silent before a user gesture',()=>{audio.playKidsFeedback(true,'approve');expect(nodes).toHaveLength(0);});
it('does not autoplay through a browser-suspended context',()=>{startState='suspended';audio.unlockKidsAudio();audio.playKidsFeedback(true,'submit');expect(nodes).toHaveLength(0);});
it('gives short feedback without speech or noisy navigation taps',()=>{audio.unlockKidsAudio();audio.playKidsFeedback(true,'tap');expect(nodes).toHaveLength(0);audio.playKidsFeedback(true,'approve');expect(nodes.length).toBeGreaterThan(0);expect(Math.max(...nodes.map(n=>n.stop.mock.calls[0][0]))-context.currentTime).toBeLessThan(1);expect(window.speechSynthesis.speak).not.toHaveBeenCalled();});
it('mute immediately disconnects every active source',()=>{audio.unlockKidsAudio();audio.playKidsFeedback(true,'reward');audio.playKidsFeedback(false,'tap');for(const n of nodes){expect(n.stop).toHaveBeenCalledTimes(2);expect(n.disconnect).toHaveBeenCalledOnce();}});
it('does not play delayed feedback after the app becomes hidden',()=>{audio.unlockKidsAudio();vi.stubGlobal('document',{hidden:true});audio.playKidsFeedback(true,'submit');expect(nodes).toHaveLength(0);});
it('a cancelled resume cannot restart sound after mute',async()=>{startState='suspended';audio.unlockKidsAudio();audio.playKidsFeedbackAfterResume(true,'reward');audio.stopKidsAudio();context.state='running';await Promise.resolve();expect(nodes).toHaveLength(0);});
it('plays after a genuine gesture resumes the context',async()=>{startState='suspended';audio.unlockKidsAudio();audio.playKidsFeedbackAfterResume(true,'approve');context.state='running';await Promise.resolve();expect(nodes.length).toBeGreaterThan(0);});
