import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const reducedMotion of ['no-preference','reduce'])for(const role of ['parent','child']){
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion});
  await context.addInitScript(role=>{
   localStorage.setItem('rlq_started','1');localStorage.setItem('real_life_quest_api_token','motion-fixture');
   localStorage.setItem('real_life_quest_api_user',JSON.stringify({id:role,displayName:role,role}));
   window.screenMotions=[];const animate=Element.prototype.animate;
   Element.prototype.animate=function(...args){if(this.classList.contains('content'))window.screenMotions.push(this.className);return animate.apply(this,args);};
  },role);
  await context.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;let json={};
   if(path==='/api/family')json={family:{id:'f'},members:[{id:'parent',role:'parent',display_name:'Dad'},{id:'child',role:'child',display_name:'Hero',coins:10,xp:20,level:1,stars:1,age:8}]};
   if(path==='/api/tasks')json={tasks:[]};if(path==='/api/submissions')json={submissions:[]};if(path==='/api/notifications')json={notifications:[]};
   if(path==='/api/safety/consent')json={children:[],history:[],scopes:{}};if(path==='/api/safety/reports')json={reports:[]};
   await route.fulfill({json});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5173');await expect(page.locator('.bottom-nav')).toBeVisible();
  // Navigate rapidly using DOM clicks so an in-flight transition is actually interrupted.
  await page.evaluate(()=>{const buttons=document.querySelectorAll('.bottom-nav button');buttons[1].click();buttons[0].click();buttons[1].click();});
  await expect(page.locator(`main.screen-${role==='parent'?'family':'quests'}`)).toBeVisible();
  const motions=await page.evaluate(()=>window.screenMotions.length);
  if(reducedMotion==='reduce'&&motions!==0)throw Error('Reduced motion started a screen animation');
  if(reducedMotion==='no-preference'&&motions===0)throw Error('No screen animation started');
  if(role==='child'){
   // Child navigation has five direct destinations rather than a More menu.
   await context.close();console.log('PASS motion and rapid navigation:',role,reducedMotion);continue;
  }
  await page.getByRole('button',{name:'More',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'more',exact:true});await expect(dialog).toBeVisible();
  await page.clock.install();await page.clock.pauseAt(new Date(Date.now()+1000));
  await dialog.getByRole('button',{name:'Close',exact:true}).click({force:true});
  if(reducedMotion==='no-preference'){
   const closing=page.locator('.modal-backdrop.is-exiting');await expect(closing).toHaveCount(1);await expect(closing).toHaveAttribute('inert','');
   await page.clock.runFor(160);
  }
  await expect(page.locator('.modal-backdrop')).toHaveCount(0);
  await expect(page.locator('.bottom-nav button',{hasText:'More'})).toBeFocused();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow');
  if(errors.length)throw Error(errors.join('\n'));
  await context.close();console.log('PASS motion, rapid navigation, dialog close/focus:',role,reducedMotion);
 }
}finally{await browser.close();}
