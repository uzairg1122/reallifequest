import {mockNativeSession} from './native-vault-fixture.mjs';
import {chromium,expect} from '@playwright/test';
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','hostinger','--host','127.0.0.1','--port','5176','--strictPort'],{stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:5176')).ok)break;}catch{}if(i===99)throw Error('Hostinger preview did not start');await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext({viewport:{width:390,height:920}});const errors=[];
 await context.addInitScript(mockNativeSession,{googleToken:'hostinger-google-fixture'});
 const session={token:'hostinger-fixture',familyId:'family',user:{id:'parent',displayName:'Parent',role:'parent'}};let seenCode;
 await context.route('**/api/**',async route=>{const request=route.request();const path=new URL(request.url()).pathname;const headers={'Access-Control-Allow-Origin':'http://127.0.0.1:5176','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET, POST, PATCH, OPTIONS'};if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}let json={ok:true};
  if(path.endsWith('/auth/google/challenge'))json={nonce:'a'.repeat(64)};
  if(path.endsWith('/auth/google')){seenCode=request.postDataJSON().coParentCode;json=session;}
  if(path.endsWith('/family'))json={family:{id:'family',parent_id:'parent'},members:[{id:'parent',display_name:'Parent',role:'parent'},{id:'child',display_name:'Hero',role:'child',age:8,coins:0,xp:0,level:1,stars:0}]};
  if(path.endsWith('/submissions'))json={submissions:[]};if(path.endsWith('/notifications'))json={notifications:[]};if(path.endsWith('/account/auth-methods'))json={google:true,primary:true,moderator:false};
  if(path.endsWith('/safety/consent'))json={children:[],history:[],scopes:{}};if(path.endsWith('/safety/reports'))json={reports:[]};
  await route.fulfill({headers,json});
 });
 const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:5176');await page.getByRole('button',{name:'Get Started'}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();await page.getByRole('button',{name:/I'm a Parent/}).click();
 await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeVisible();await expect(page.locator('input[type=password]')).toHaveCount(0);await expect(page.getByRole('link',{name:/recovering your Google account/})).toHaveAttribute('href','https://accounts.google.com/signin/recovery');
 await page.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(page.locator('.parent-dashboard')).toBeVisible();await page.locator('.bottom-nav button').nth(1).click();await expect(page.locator('.parent-account')).toBeVisible();await expect(page.getByRole('button',{name:'Change my password'})).toHaveCount(0);await page.getByRole('button',{name:'Delete profile',exact:true}).click();await expect(page.getByRole('button',{name:'Verify with Google',exact:true})).toBeVisible();await expect(page.locator('input[type=password]')).toHaveCount(0);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.reload();await expect(page.locator('.parent-dashboard')).toBeVisible();await context.clearCookies();await page.evaluate(()=>localStorage.clear());await page.goto('http://127.0.0.1:5176/?coparent=123456');await page.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(page.locator('.parent-dashboard')).toBeVisible();expect(seenCode).toBe('123456');expect(new URL(page.url()).search).toBe('');
 await page.evaluate(()=>localStorage.clear());await page.goto('http://127.0.0.1:5176/?invite=123456');await expect(page.getByLabel('Child PIN',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toHaveCount(0);
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS Hostinger Google-only parent UI, Google confirmation, recovery link, returning session, Google co-parent code and child name/PIN unchanged. Native Google token handoff is mocked.');
}finally{await browser?.close();server.kill();}
