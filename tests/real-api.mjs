import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:8081/api';
export async function call(path,token,body,method=body?'POST':'GET',expected=200){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();let result;try{result=JSON.parse(text);}catch{throw Error(path+': non-JSON '+text.slice(0,400));}
 assert.equal(r.status,expected,`${path}: ${text}`);return result;
}
const stamp=Date.now(),password='audit-password-123';
const parent=await call('/auth/register',null,{email:`parent-${stamp}@example.test`,password,displayName:'Audit Parent'},'POST',201);
const stranger=await call('/auth/register',null,{email:`other-${stamp}@example.test`,password,displayName:'Other Family'},'POST',201);
const task={title:'Brush Your Teeth',missionTitle:'Brush Your Teeth',description:'Brush all sides',category:'Morning Routine',icon:'🪥',days:'both',coins:15,xp:20};
const invite=await call('/families/pairing-code',parent.token,{childName:'Audit Imran',childAge:11,tasks:Array.from({length:5},(_,i)=>({...task,title:i?`Starter ${i}`:task.title}))});
const child=await call('/auth/register-child',null,{displayName:`Audit Imran ${stamp}`,age:11,code:invite.code,pin:'2468'},'POST',201);
const login=await call('/auth/child-login',null,{displayName:child.user.displayName,pin:'2468'});assert.equal(login.user.id,child.user.id);
let tasks=(await call('/tasks',child.token)).tasks;assert.equal(tasks.length,5);assert.equal(tasks[0].category,'Morning Routine');assert.equal(tasks[0].icon,'🪥');
const custom=await call('/tasks',parent.token,{...task,title:'Clean the room',missionTitle:'Defeat the Mess Monster',category:'Tidy & Order',icon:'🧹',childId:child.user.id,photoRequired:true},'POST',201);
await call('/tasks',stranger.token,{...task,childId:child.user.id},'POST',403);
await call(`/tasks/${custom.id}/submit`,child.token,{},'POST',422);
const picture='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEn8AAAAASUVORK5CYII=';
let submission=await call(`/tasks/${custom.id}/submit`,child.token,{proofUrl:picture},'POST',201);
await call(`/tasks/${custom.id}/submit`,child.token,{proofUrl:picture},'POST',422);
let review=(await call('/submissions',parent.token)).submissions.find(s=>s.submission_id===submission.submissionId);assert.equal(review.proof_url,undefined);assert.equal((await call(`/submissions/${submission.submissionId}/proof`,parent.token)).proofUrl,picture);assert.equal(review.child_name,child.user.displayName);
await call(`/submissions/${submission.submissionId}/reject`,parent.token,{feedback:'Finish the last corner'});
submission=await call(`/tasks/${custom.id}/submit`,child.token,{proofUrl:picture},'POST',201);
await call(`/submissions/${submission.submissionId}/approve`,stranger.token,{},'POST',422);
await call(`/submissions/${submission.submissionId}/approve`,parent.token,{});
await call(`/submissions/${submission.submissionId}/approve`,parent.token,{},'POST',422);
let me=(await call('/family',child.token)).members.find(m=>m.id===child.user.id);assert.equal(Number(me.coins),15);assert.equal(Number(me.xp),20);
assert((await call('/notifications',child.token)).notifications.some(n=>n.type==='task_approved'));
await call('/profile',child.token,{avatarData:picture},'PATCH');await call('/profile',stranger.token,{childId:child.user.id,displayName:'Wrong',age:8},'PATCH',403);
await call('/profile',parent.token,{childId:child.user.id,displayName:'Updated Imran',age:12},'PATCH');me=(await call('/family',child.token)).members.find(m=>m.id===child.user.id);assert.equal(me.display_name,'Updated Imran');assert.equal(Number(me.age),12);assert.equal(me.avatar_data,picture);
await call('/profile',child.token,{avatarData:'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='},'PATCH',422);
await call('/family/delete-child',stranger.token,{childId:child.user.id,password},'POST',404);
// Keep these isolated test accounts for the browser journey. No live accounts are used.
await writeFile('artifacts/real-session.json',JSON.stringify({parent,child,stranger,password,stamp}));
console.log('PASS real PHP/MariaDB: invite + PIN login, preset metadata, assignment isolation, required proof, photo persistence, reject/resubmit, approval exactly once, notifications, profile edit/photo, cross-family denial.');
