import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const bases=['http://127.0.0.1:8091/api','http://127.0.0.1:8092/api'];
async function call(base,path,body,token){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});return {status:r.status,body:await r.json()};}
const stamp=Date.now();const parent=await call(bases[0],'/auth/register',{email:`invite-audit-${stamp}@example.test`,displayName:'Invite audit',password:'AuditPassword123'});
if(parent.status!==201)throw Error(JSON.stringify(parent));
const token=parent.body.token;
const coparent=await call(bases[0],'/families/co-parent-code',{},token);
const wrongKind=await call(bases[0],'/auth/register-child',{displayName:`Wrong kind ${stamp}`,age:9,pin:'2468',code:coparent.body.code});
assert.equal(wrongKind.status,422);let race;
for(let round=0;round<3;round++){
 const invite=await call(bases[0],'/families/pairing-code',{childName:'Race Child',childAge:9,tasks:Array.from({length:20},(_,i)=>({title:'Mission '+i,missionTitle:'Mission '+i,coins:1,xp:10,category:'Morning Routine',icon:'⭐',days:'both'}))},token);
 if(invite.status!==200)throw Error(JSON.stringify(invite));
 const results=await Promise.all(bases.map((base,i)=>call(base,'/auth/register-child',{displayName:`Race ${stamp} ${round} ${i}`,age:9,pin:'2468',code:invite.body.code})));
 race={round,statuses:results.map(r=>r.status),distinctChildren:new Set(results.filter(r=>r.status===201).map(r=>r.body.user.id)).size};
 assert.equal(race.distinctChildren,1);assert.deepEqual([...race.statuses].sort(),[201,422]);
}
const evidence={wrongInviteKindStatus:wrongKind.status,concurrentSingleUseInvite:race};
await writeFile('artifacts/release-invite-evidence.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
