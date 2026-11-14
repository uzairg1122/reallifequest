import {describe,expect,it} from 'vitest';
import {taskIcon} from './taskIcons';
import {PRESETS} from './presets';
describe('task icons for legacy and new assignments',()=>{
 it('repairs generic swords for every preset regardless of case and whitespace',()=>{
  for(const p of PRESETS)expect(taskIcon(` ${p.name.toUpperCase()} `,'⚔️')).toBe(p.icon);
 });
 it('uses task subject rather than the routine for custom missions',()=>{
  expect(taskIcon('Clean my room','⚔️')).toBe('🧹');
  expect(taskIcon('Practice piano')).toBe('🎵');
  expect(taskIcon('A reading adventure','⚔️','Choose a Bedtime Story')).toBe('📖');
 });
 it('preserves an explicitly chosen icon',()=>expect(taskIcon('Clean my room','🚲')).toBe('🚲'));
});
