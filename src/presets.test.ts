import {describe,it,expect,vi,afterEach} from 'vitest';
import {allowPresets,findPresetQuest,PRESETS} from './presets';
import {initialState,approveQuest,submitQuest,rollover,visibleQuests} from './state';

afterEach(()=>vi.useRealTimers());
describe('parent preset selection',()=>{
  it('does not add presets until selected and allowed',()=>{
    const s=initialState();
    expect(s.quests.some(q=>q.presetId==='wash-face')).toBe(false);
    const result=allowPresets(s,['wash-face']);
    expect(result.quests).toHaveLength(s.quests.length+1);
    expect(result.quests.at(-1)?.enabled).toBe(true);
    expect(s.quests.some(q=>q.presetId==='wash-face')).toBe(false);
  });
  it('deduplicates repeated selections and legacy starter tasks',()=>{
    const s=initialState();
    const next=allowPresets(s,['morning-teeth','get-dressed','wash-face','wash-face']);
    expect(next.quests).toHaveLength(s.quests.length+1);
    expect(allowPresets(next,['wash-face']).quests).toHaveLength(next.quests.length);
  });
  it('preserves customized task rewards, proof and schedule when enabling',()=>{
    const s=initialState();
    s.quests=s.quests.map(q=>q.id==='bed'?{...q,name:'My Cozy Bed',enabled:false,coins:77,status:'waiting',proof:'photo',days:'Weekends'}:q);
    const original=s.quests.find(q=>q.id==='bed')!;
    const next=allowPresets(s,['make-bed'],'Weekdays');
    expect(next.quests.find(q=>q.id==='bed')).toEqual({...original,enabled:true});
    expect(next.quests).toHaveLength(s.quests.length);
  });
  it('recognizes an equivalent custom task without overwriting it',()=>{
    const s=initialState();
    s.quests.push({id:'custom',name:'  Wash Face & Hands  ',category:'Morning Routine',icon:'✨',description:'My own steps',coins:99,xp:10,status:'active',enabled:true,days:'Weekends'});
    expect(allowPresets(s,['wash-face']).quests).toHaveLength(s.quests.length);
  });
  it('supports school-day presets and explicit schedule overrides',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-19T12:00:00'));
    const next=allowPresets(initialState(),['water-bottle']);
    expect(visibleQuests(next).some(q=>q.presetId==='water-bottle')).toBe(false);
    const override=allowPresets(initialState(),['water-bottle'],'Weekends');
    expect(visibleQuests(override).some(q=>q.presetId==='water-bottle')).toBe(true);
  });
  it('keeps one-time tasks pending across days, then does not repeat completed ones',()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date('2026-09-16T12:00:00'));
    const s=allowPresets(initialState(),['match-socks']);
    const task=findPresetQuest(s.quests,PRESETS.find(p=>p.id==='match-socks')!)!;
    vi.setSystemTime(new Date('2026-09-17T12:00:00'));
    const next=rollover(s);
    expect(visibleQuests(next).some(q=>q.id===task.id)).toBe(true);
    const done=approveQuest(submitQuest(next,task.id),task.id);
    expect(visibleQuests(done).find(q=>q.id===task.id)?.status).toBe('completed');
    vi.setSystemTime(new Date('2026-09-18T12:00:00'));
    const followingDay=rollover(done);
    expect(followingDay.quests.find(q=>q.id===task.id)?.status).toBe('completed');
    expect(visibleQuests(followingDay).some(q=>q.id===task.id)).toBe(false);
    expect(approveQuest(followingDay,task.id).coins).toBe(done.coins);
  });
  it('ignores unknown preset IDs',()=>expect(allowPresets(initialState(),['missing']).quests).toHaveLength(initialState().quests.length));
});
