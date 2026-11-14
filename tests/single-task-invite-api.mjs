import assert from 'node:assert/strict';
const base='http://127.0.0.1:8091/api';
async function call(path,token,body,status=200){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,status,`${path}: ${JSON.stringify(data)}`);return data;}
const parent=await call('/auth/register',null,{email:`single-task-${Date.now()}@example.test`,password:'Fixture-only-password-123',displayName:'Single task audit'},201);
const input={childName:'One mission child',childAge:8};
await call('/families/pairing-code',parent.token,{...input,tasks:[]},400);
const task={title:'Put toys away',description:'One starter mission',coins:10,xp:10,photoMode:'optional'};
await call('/families/pairing-code',parent.token,{...input,tasks:Array.from({length:31},()=>task)},400);
const invite=await call('/families/pairing-code',parent.token,{...input,tasks:[task]});
const child=await call('/auth/register-child',null,{displayName:input.childName,age:input.childAge,code:invite.code,pin:'2468'},201);
const result=await call('/tasks',child.token);assert.equal(result.tasks.length,1);assert.equal(result.tasks[0].title,task.title);
console.log('PASS disposable audit API: zero/31 task invites rejected; one task invite consumed and exactly one starter task created.');
