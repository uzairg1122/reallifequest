import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
const port=5182,origin=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','hostinger','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}if(i===99)throw Error('Preview did not start');await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}}),errors=[],registrations=[];
 await context.addInitScript(()=>{
  localStorage.setItem('real_life_quest_api_token','fixture-parent-session');localStorage.setItem('real_life_quest_api_user',JSON.stringify({id:'parent',displayName:'Parent',role:'parent'}));localStorage.setItem('rlq_started','1');
  let status={enabled:false,permission:true,needsPermissionPrompt:true,sound:'gentle',customName:'',installationId:'a'.repeat(36)};window.testPhoneCalls=[];
  window.androidBridge={};window.Capacitor={PluginHeaders:[{name:'SessionVault',methods:[{name:'get',rtype:'promise'},{name:'set',rtype:'promise'}]},{name:'QuestNotifications',methods:['bind','disconnect','status','enable','disable','token','registered','opened','setSound','preview','importSound','systemSettings','show','test'].map(name=>({name,rtype:'promise'})).concat([{name:'addListener',rtype:'callback'},{name:'removeListener',rtype:'promise'}])}],nativeCallback:(_plugin,_method,input,callback)=>{window.testPushCallbacks??={};window.testPushCallbacks[input.eventName]=callback;return input.eventName;},nativePromise:async(plugin,method,input)=>{
   if(plugin==='SessionVault'){if(method==='get')return{value:localStorage.getItem('_mock_vault')||undefined};localStorage.setItem('_mock_vault',input.value);return{};}
   if(plugin==='QuestNotifications'){window.testPhoneCalls.push(method);if(method==='opened')return{opened:false};if(method==='test'||method==='show')return{handled:true};if(method==='enable')status.enabled=true;if(method==='disable')status.enabled=false;if(method==='setSound')status.sound=input.sound;if(method==='token')return{...status,token:'fixture-fcm-token'};if(method==='importSound')return{...status,cancelled:true};return{...status};}
   return{};
  }};
 });
 await context.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname,headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS'};
  if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  let json={ok:true};if(path.endsWith('/family'))json={family:{id:'family',name:'Family',parent_id:'parent'},members:[{id:'parent',display_name:'Parent',role:'parent',coins:0,xp:0}]};if(path.endsWith('/submissions'))json={submissions:[]};if(path.endsWith('/notifications'))json={notifications:[]};if(path.endsWith('/account/auth-methods'))json={google:true,primary:true};if(path.endsWith('/families/parents'))json={parents:[],viewerIsPrimary:true};if(path.endsWith('/notifications/device'))registrations.push(req.postDataJSON());
  await route.fulfill({headers,json});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});await expect(page.locator('.parent-dashboard')).toBeVisible();await page.getByRole('button',{name:'Settings',exact:true}).click();
 await expect(page.getByText('Phone notifications & sounds',{exact:true})).toBeVisible();
 await expect.poll(()=>registrations[0]?.token).toBe('fixture-fcm-token');
 const toggle=page.getByRole('switch',{name:'Phone notifications',exact:true});
 await expect(toggle).toHaveAttribute('aria-checked','true');
 await expect(page.getByRole('button',{name:'Test tray notification',exact:true})).toHaveCount(0);
 await page.getByLabel('Notification sound',{exact:true}).selectOption('soft');
 await page.getByRole('button',{name:'Add custom audio',exact:true}).click();await expect(page.getByLabel('Notification sound',{exact:true})).toHaveValue('soft');
 await page.getByLabel('Notification sound',{exact:true}).selectOption('silent');
 await expect(page.getByLabel('Notification sound',{exact:true})).toHaveValue('silent');
 await toggle.click();await expect(toggle).toHaveAttribute('aria-checked','false');
 await expect.poll(()=>registrations.at(-1)?.disable).toBe(true);
 await page.setViewportSize({width:320,height:640});
 const actions=page.locator('.notification-actions');
 expect(await actions.evaluate(node=>node.scrollWidth<=node.clientWidth)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS automatic notification registration, sound selection, import cancellation, disable/unregister and 320px layout. Native FCM/audio picker mocked.');
}finally{await browser?.close();server.kill();}
