import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','hostinger','--host','127.0.0.1','--port','5178','--strictPort'],{stdio:'ignore',windowsHide:true});let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5178')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});const errors=[];let current='a',googleCalls=0,offline=false;const logouts=[];
 await context.addInitScript(()=>{
  if(!localStorage.getItem('_seeded')){localStorage.setItem('_seeded','1');localStorage.setItem('real_life_quest_api_token','session-a');localStorage.setItem('real_life_quest_api_user',JSON.stringify({id:'parent-a',displayName:'Parent A',role:'parent'}));localStorage.setItem('rlq_started','1');localStorage.setItem('rlq_proof_draft_child-a_task',JSON.stringify({after:'private-draft-a'}));}
  window.androidBridge={};window.Capacitor={PluginHeaders:[{name:'SessionVault',methods:[{name:'get',rtype:'promise'},{name:'set',rtype:'promise'}]},{name:'ParentGoogleAuth',methods:[{name:'signIn',rtype:'promise'}]}],nativePromise:async(p,m,input)=>{if(p==='SessionVault'){if(m==='get')return{value:localStorage.getItem('_mock_encrypted_vault')||undefined};localStorage.setItem('_mock_encrypted_vault',input.value);return{};}return{idToken:'fixture-google'};}};
 });
 await context.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;const headers={'Access-Control-Allow-Origin':'http://127.0.0.1:5178','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS'};if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  if(offline&&(path.endsWith('/family')||path.endsWith('/auth/logout'))){await route.abort();return;}
  const token=req.headers().authorization||'',who=token.endsWith('session-b')?'b':'a';let json={ok:true};
  if(path.endsWith('/auth/google/challenge'))json={nonce:'a'.repeat(64)};
  if(path.endsWith('/auth/google')){googleCalls++;json={token:`session-${current}`,familyId:`family-${current}`,user:{id:`parent-${current}`,displayName:`Parent ${current.toUpperCase()}`,role:'parent'}};}
  if(path.endsWith('/auth/logout'))logouts.push(token);
  if(path.endsWith('/family'))json={family:{id:`family-${who}`,parent_id:`parent-${who}`},members:[{id:`child-${who}`,display_name:`Private child ${who.toUpperCase()}`,role:'child',coins:10,xp:10,level:1,stars:0}]};
  if(path.endsWith('/families/parents'))json={parents:[],viewerIsPrimary:true};if(path.endsWith('/moderation/reports'))json={reports:[]};
  if(path.endsWith('/submissions'))json={submissions:[]};if(path.endsWith('/notifications'))json={notifications:[]};if(path.endsWith('/account/auth-methods'))json={google:true,primary:true};
  await route.fulfill({headers,json});
 });
 const page=await context.newPage();page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});await page.goto('http://127.0.0.1:5178',{waitUntil:'domcontentloaded'});await expect(page.locator('.parent-dashboard')).toBeVisible();await expect(page.getByText('Private child A',{exact:true}).first()).toBeVisible();expect(googleCalls).toBe(0);expect(await page.evaluate(()=>localStorage.getItem('real_life_quest_api_token'))).toBeNull();
 await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.parent-dashboard')).toBeVisible();expect(googleCalls).toBe(0);
 offline=true;await page.reload({waitUntil:'domcontentloaded'});await expect(page.locator('.parent-dashboard')).toBeVisible();await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toHaveCount(0);offline=false;await page.reload({waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Log Out',exact:true}).click();await expect(page.getByRole('button',{name:'Get Started',exact:true})).toBeVisible();expect(logouts).toEqual(['Bearer session-a']);
 current='b';await page.getByRole('button',{name:'Get Started',exact:true}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('button',{name:/I'm a Parent/}).click();await page.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(page.getByText('Private child B',{exact:true}).first()).toBeVisible();await expect(page.getByText('Private child A',{exact:true})).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('rlq_proof_draft_child-a_task'))).toContain('private-draft-a');expect(googleCalls).toBe(1);
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS secure-store handoff/migration, reload without Google, offline retains session, server logout called, account B cannot see A cache, owner-scoped drafts retained. Keystore is mocked.');
}finally{await browser?.close();server.kill();}
