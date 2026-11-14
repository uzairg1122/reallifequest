import assert from 'node:assert/strict';
const base='http://127.0.0.1:8081/api';
async function post(path,body){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});return {status:r.status,body:await r.json()};}
const one=await post('/auth/google/challenge',{});
assert.equal(one.status,200);assert.match(one.body.nonce,/^[a-f0-9]{64}$/);
const two=await post('/auth/google/challenge',{});assert.notEqual(one.body.nonce,two.body.nonce);
const malformed=await post('/auth/google',{nonce:one.body.nonce,idToken:'forged'});assert.equal(malformed.status,401);
const expired=await post('/auth/google',{nonce:'b'.repeat(64),idToken:'forged'});assert.equal(expired.status,401);
const invalid=await post('/auth/google',{nonce:'invalid',idToken:'forged'});assert.equal(invalid.status,401);
console.log('PASS Google challenge uniqueness, invalid nonce, unknown nonce, forged token rejected');
