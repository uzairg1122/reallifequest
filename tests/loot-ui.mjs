import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
let tasks=[['story','Choose a Bedtime Story'],['teeth','Brush Teeth Before Bed'],['pyjamas','Put On Pyjamas']].map(([id,title])=>({id,title,mission_title:title,icon:'⚔️',category:'Bedtime Wind-Down',status:'active',coins:15,xp:20,assigned_to:'kid',description:'Your little adventure',family_id:'family',created_by:'parent'}));
let assigned=null;
const approval={id:'win',type:'task_approved',title:'Mission approved!',body:'+15 coins and +20 XP earned.',created_at:'2026-09-21 00:00:00'};
async function open(role,reducedMotion='no-preference'){
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion});
 await context.addInitScript(role=>{localStorage.setItem('real_life_quest_api_token','ui-test');localStorage.setItem('real_life_quest_api_user',JSON.stringify({id:role==='child'?'kid':'parent',displayName:role==='child'?'Imran':'Dad',role}));localStorage.setItem('rlq_started','1');},role);
 await context.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,method=route.request().method();let data={};
  if(path==='/api/family')data={family:{id:'family',name:'Our family'},members:[{id:'kid',display_name:'Imran',role:'child',coins:15,xp:20,level:1,stars:1,age:11},{id:'parent',display_name:'Dad',role:'parent',coins:0,xp:0,level:1,stars:0}]};
  if(path==='/api/tasks'&&method==='GET')data={tasks};
  if(path==='/api/tasks'&&method==='POST'){assigned=route.request().postDataJSON();data={id:'new'};}
  if(path==='/api/submissions')data={submissions:[]};
  if(path==='/api/notifications')data={notifications:role==='child'?[approval]:[]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();await page.goto('http://127.0.0.1:5173');return page;
}
try{
 const kid=await open('child');const dialog=kid.getByRole('dialog',{name:'Mission approved'});
 await expect(dialog).toBeVisible({timeout:15000});await expect(dialog.locator('img')).toBeVisible();
 await expect(dialog.locator('img')).toHaveJSProperty('complete',true);
 await kid.screenshot({path:'artifacts/loot-before.png',animations:'disabled'});
 await dialog.getByRole('button',{name:'Reveal my rewards',exact:true}).first().click();
 await expect(dialog.locator('.loot-reward.gold strong')).toHaveText('+15');await expect(dialog.locator('.loot-reward.violet strong')).toHaveText('+20');
 await dialog.getByRole('button',{name:'Rewards revealed',exact:true}).click();await expect(dialog.locator('.loot-reward')).toHaveCount(2);
 await expect(dialog.locator('.animated-chest,.gift-pop')).toHaveCount(0);
 await expect(dialog.locator('img')).toHaveAttribute('src',/treasure-chest.*[.]png/);
 await expect.poll(()=>dialog.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await kid.screenshot({path:'artifacts/loot-revealed.png',animations:'disabled'});
 await kid.setViewportSize({width:320,height:650});await expect(dialog.getByRole('button',{name:/Awesome/})).toBeInViewport();await kid.screenshot({path:'artifacts/loot-320.png',animations:'disabled'});
 await dialog.getByRole('button',{name:/Awesome/}).click();await kid.getByRole('button',{name:/Bedtime Wind-Down/}).click();
 for(const [title,icon] of [['Choose a Bedtime Story','📖'],['Brush Teeth Before Bed','🪥'],['Put On Pyjamas','🌙']])await expect(kid.getByRole('button',{name:new RegExp(title)}).locator('.tile-icon')).toHaveText(icon);
 await kid.setViewportSize({width:390,height:844});await kid.screenshot({path:'artifacts/task-icons-bedtime.png',animations:'disabled'});
 await kid.reload();await expect(kid.getByRole('heading',{name:/Let’s go/})).toBeVisible();await expect(kid.getByRole('dialog')).toHaveCount(0);
 const parent=await open('parent');await expect(parent.getByRole('heading',{name:'Your family dashboard'})).toBeVisible();await expect(parent.locator('.loot-card')).toHaveCount(0);
 const board=parent.locator('.parent-task-board');await board.getByRole('button',{name:'Custom task',exact:true}).click();await board.getByLabel('Task name',{exact:true}).fill('Practice piano');await board.getByLabel('Instructions',{exact:true}).fill('Play your favourite tune');await expect(board.getByRole('button',{name:'Use 🎵 icon'})).toHaveAttribute('aria-pressed','true');await board.getByRole('button',{name:'Use ⭐ icon'}).click();await board.getByRole('button',{name:'Assign custom task',exact:true}).click();await expect(board.getByRole('status')).toContainText('assigned');if(assigned.icon!=='⭐')throw Error('Chosen icon did not persist in request');
 await parent.screenshot({path:'artifacts/task-icon-picker.png',animations:'disabled'});
 const reduced=await open('child','reduce');await expect(reduced.locator('.loot-card')).toBeVisible({timeout:15000});if(await reduced.locator('.loot-sparkles i').first().evaluate(e=>getComputedStyle(e).animationName)!=='none')throw Error('Reduced-motion setting ignored');await reduced.keyboard.press('Escape');await expect(reduced.locator('.loot-card')).toHaveCount(0);
 console.log('PASS UI fixtures: legacy preset icons, automatic/custom icon assignment, real approval amounts, chest reveal without duplicates, child-only modal, reload dismissal, 320px layout, keyboard close and reduced motion.');
}finally{await browser.close();}
