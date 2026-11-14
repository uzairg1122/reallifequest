import {mockNativeSession} from './native-vault-fixture.mjs';
import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','hostinger','--host','127.0.0.1','--port','5177','--strictPort'],{stdio:'ignore',windowsHide:true});
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aEn8AAAAASUVORK5CYII=';
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5177')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});let inviteTasks;
 await context.addInitScript(mockNativeSession,{image});
 await context.route('**/api/**',async route=>{const req=route.request(),path=new URL(req.url()).pathname;const headers={'Access-Control-Allow-Origin':'http://127.0.0.1:5177','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS'};if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}let json={ok:true};
  if(path.endsWith('/auth/google/challenge'))json={nonce:'a'.repeat(64)};
  if(path.endsWith('/auth/google'))json={token:'fixture',familyId:'family',user:{id:'parent',displayName:'Parent',role:'parent'}};
  if(path.endsWith('/family'))json={family:{id:'family',parent_id:'parent'},members:[{id:'parent',display_name:'Parent',role:'parent'},{id:'child',display_name:'Hero',role:'child',age:8,coins:10,xp:10,level:1,stars:0}]};
  if(path.endsWith('/submissions'))json={submissions:[{submission_id:'proof',task_id:'task',child_id:'child',child_name:'Hero',title:'Brush teeth',description:'Test',status:'approved',coins:10,xp:10,has_proof:1}],nextCursor:null};
  if(path.endsWith('/submissions/proof/proof'))json={proofUrl:image,proofBeforeUrl:null};
  if(path.endsWith('/notifications'))json={notifications:[]};
  if(path.endsWith('/families/pairing-code')){inviteTasks=req.postDataJSON().tasks;json={code:'123456'};}
  await route.fulfill({headers,json});
 });
 const page=await context.newPage();page.on('pageerror',e=>console.error('Fixture page error:',e.message));await page.goto('http://127.0.0.1:5177',{waitUntil:'domcontentloaded',timeout:60000});await page.getByRole('button',{name:'Get Started'}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('button',{name:/I'm a Parent/}).click();await page.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(page.locator('.parent-dashboard')).toBeVisible();
 await page.locator('.bottom-nav button').nth(2).click();await page.getByRole('button',{name:'Completed',exact:true}).click();await page.getByRole('button',{name:'View photo proof',exact:true}).click();await page.getByRole('button',{name:'View task photo for Brush teeth',exact:true}).click();await expect(page.getByAltText('Full submitted quest proof')).toHaveAttribute('src',image);await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('.bottom-nav button').nth(0).click();await page.getByRole('button',{name:'Invite another child',exact:true}).click();await page.locator('input[name=childName]').fill('One task hero');const checks=page.locator('.invite-task-list input[type=checkbox]');for(let i=0;i<await checks.count();i++)await checks.nth(i).uncheck();const create=page.getByRole('button',{name:/Create invite/});await expect(create).toBeDisabled();await checks.first().check();await expect(create).toBeEnabled();await create.click();await expect(page.getByText('Invite ready!',{exact:true})).toBeVisible();expect(inviteTasks).toHaveLength(1);
 // Exercise the real PhotoProof component's Android bridge handoff without a physical camera.
 await page.route('**/camera-fixture',route=>route.fulfill({contentType:'text/html',body:`<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;import React from '/node_modules/.vite/deps/react.js';import ReactDOM from'/node_modules/.vite/deps/react-dom_client.js';const {default:PhotoProof}=await import('/src/PhotoProof.tsx');window.cameraOptions=null;ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(PhotoProof,{quest:{id:'camera',name:'Camera mission',icon:'📷',photoMode:'optional'},owner:'fixture',onSubmit:async()=>true,onBack:()=>{}}));</script>`}));
 await page.goto('http://127.0.0.1:5177/camera-fixture');await page.getByRole('button',{name:'Take your task photo photo',exact:true}).click();await expect(page.getByAltText('Your task photo photo preview')).toBeVisible();expect(await page.evaluate(()=>cameraOptions.source)).toBe('CAMERA');expect(await page.evaluate(()=>cameraOptions.saveToGallery)).toBe(false);
 console.log('PASS completed remote photo opens full preview, one-task invite enabled/zero disabled, Android camera handoff and returned photo preview. Native camera is mocked.');
}finally{await browser?.close();server.kill();}
