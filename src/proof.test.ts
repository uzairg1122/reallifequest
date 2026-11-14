import {describe,it,expect} from 'vitest';
import {initialState,submitQuest,approveQuest,touchupQuest} from './state';
import {photoMode,proofError} from './proof';
describe('photo proof policies',()=>{
 it('keeps legacy required and optional tasks compatible',()=>{expect(photoMode({photo:true})).toBe('required');expect(photoMode({photo:false})).toBe('optional');expect(proofError('optional')).toBe('');expect(proofError('required')).not.toBe('');});
 it('requires both photos and pays only once after approval',()=>{const s=initialState();s.quests=s.quests.map(q=>q.id==='toys'?{...q,photoMode:'before_after'}:q);expect(submitQuest(s,'toys','after')).toBe(s);expect(submitQuest(s,'toys',undefined,'before')).toBe(s);const sent=submitQuest(s,'toys','after','before');expect(sent.coins).toBe(0);expect(sent.quests.find(q=>q.id==='toys')?.proofBefore).toBe('before');const approved=approveQuest(sent,'toys');expect(approved.coins).toBe(20);expect(approved.quests.find(q=>q.id==='toys')?.proofBefore).toBeUndefined();expect(approveQuest(approved,'toys')).toBe(approved);});
 it('clears both old proofs on retry and requires new pair',()=>{const s=initialState();s.quests=s.quests.map(q=>q.id==='toys'?{...q,photoMode:'before_after'}:q);const retry=touchupQuest(submitQuest(s,'toys','after','before'),'toys','Try again');expect(retry.quests.find(q=>q.id==='toys')?.proofBefore).toBeUndefined();expect(submitQuest(retry,'toys','new-after')).toBe(retry);expect(submitQuest(retry,'toys','new-after','new-before').quests.find(q=>q.id==='toys')?.status).toBe('waiting');});
});
