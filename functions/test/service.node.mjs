import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createService} from '../src/service.js';
import {memoryServices} from './memory.js';
import {runScenario} from './scenario.js';
test('HTTP service business flows with serialized in-memory transaction double',async()=>{
 process.env.PUBLIC_APP_URL='https://demo-rlq.web.app/real-life-quest';process.env.MODERATION_ADMIN_EMAILS='';const services=memoryServices();const service=createService(services);const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 async function call(path,token,body,expected=200,method=body?'POST':'GET'){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});const data=await response.json();assert.equal(response.status,expected,path+': '+JSON.stringify(data));return data;}
 try{await runScenario({...services,base,call});}finally{await new Promise(r=>server.close(r));}
});
