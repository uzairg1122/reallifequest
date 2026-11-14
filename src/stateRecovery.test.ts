import {describe,it,expect,vi,afterEach} from 'vitest';
import {initialState,loadState,visibleQuests} from './state';
afterEach(()=>vi.unstubAllGlobals());
function storage(value:string){const values:Record<string,string>={real_life_quest_state_v1_family:value};vi.stubGlobal('localStorage',{getItem:(k:string)=>values[k]??null,setItem:(k:string,v:string)=>{values[k]=v}});return values;}
describe('saved family recovery',()=>{
 it('repairs a null quest and preserves a recovery copy',()=>{const raw=JSON.stringify({...initialState(),coins:72,quests:[null]});const values=storage(raw);const restored=loadState();expect(()=>visibleQuests(restored)).not.toThrow();expect(restored.coins).toBe(72);expect(values.rlq_state_recovery_backup_v1).toBe(raw)});
 it('preserves valid progress and pending proof',()=>{const state=initialState();state.coins=81;state.quests[0]={...state.quests[0],status:'waiting',proof:'saved-photo'};storage(JSON.stringify(state));const result=loadState();expect(result.coins).toBe(81);expect(result.quests[0].proof).toBe('saved-photo');expect(result.quests[0].status).toBe('waiting')});
 it('recovers broken schedules and array fields without deleting the original save',()=>{const raw=JSON.stringify({...initialState(),schedule:null,notices:[null],redemptions:null});const values=storage(raw);const result=loadState();expect(result.schedule.Weekends.curfew).toBeTruthy();expect(result.notices).toEqual([]);expect(result.redemptions).toEqual([]);expect(values.real_life_quest_state_v1_family).toBe(raw)});
 it('backs up invalid JSON instead of silently losing it',()=>{const values=storage('{bad');expect(loadState().level).toBe(1);expect(values.rlq_state_recovery_backup_v1).toBe('{bad')});
});
