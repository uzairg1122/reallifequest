const base=process.argv[2];if(!base)throw Error('Usage: node scripts/check-production.mjs https://nomolabs.pro/api');
const url=new URL(base);if(url.protocol!=='https:')throw Error('Public HTTPS required.');
const health=await fetch(base.replace(/\/$/,'')+'/health',{signal:AbortSignal.timeout(15000)});
const data=await health.json().catch(()=>null);if(!health.ok||data?.service!=='real-life-quest-api')throw Error('A healthy Real Life Quest API was not found. Deploy/configure the backend first.');
const challenge=await fetch(base.replace(/\/$/,'')+'/auth/google/challenge',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
const result=await challenge.json();if(!challenge.ok||!/^[a-f0-9]{64}$/.test(result.nonce??''))throw Error('Google login server configuration is not ready.');
console.log('PASS HTTPS API health and Google challenge. Next verify Play-signed Google login, mail delivery, deletion and two-device flows.');
