import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const sessions=JSON.parse(await readFile('artifacts/real-session.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const issues=[];
async function pageFor(session){
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 await ctx.addInitScript(session=>{localStorage.setItem('real_life_quest_api_token',session.token);localStorage.setItem('real_life_quest_api_user',JSON.stringify(session.user));localStorage.setItem('rlq_started','1');},session);
 await ctx.route('**/api/**',async route=>{const u=new URL(route.request().url());const response=await route.fetch({url:'http://127.0.0.1:8081'+u.pathname+u.search});await route.fulfill({response});});
 const page=await ctx.newPage();page.on('pageerror',e=>issues.push(e.message));await page.goto('http://127.0.0.1:5173');return page;
}
try{
 const parent=await pageFor(sessions.parent),kid=await pageFor(sessions.child);
 await expect(parent.getByRole('heading',{name:'Your family dashboard'})).toBeVisible();
 await expect(kid.getByRole('dialog',{name:'Mission approved'})).toBeVisible({timeout:15000});await kid.getByRole('button',{name:'Reveal my rewards',exact:true}).first().click();await kid.getByRole('button',{name:/Awesome! Keep going/}).click();
 const board=parent.locator('.parent-task-board');await board.locator('select').first().selectOption(sessions.child.user.id);await board.getByLabel('Find a task').fill('Read');await board.locator('.parent-preset-card').first().click();await board.getByRole('button',{name:'Assign 1 selected tasks'}).click();await expect(board.getByRole('status')).toContainText('assigned to Updated Imran');
 await kid.getByRole('button',{name:'Refresh tasks'}).click();await kid.getByRole('button',{name:/School & Homework/}).click();await expect(kid.getByRole('button',{name:/Read/}).first()).toBeVisible();
 await kid.getByRole('button',{name:/Read/}).first().click();await kid.getByRole('button',{name:'Add Photo Proof'}).click();
 await kid.screenshot({animations:'disabled',path:'artifacts/audit-photo-empty.png'});
 await kid.locator('input[type=file]').last().setInputFiles('artifacts/audit-photo-empty.png');await expect(kid.getByRole('button',{name:'Submit Photo'})).toBeVisible();await kid.screenshot({animations:'disabled',path:'artifacts/audit-photo-ready.png'});await kid.getByRole('button',{name:'Submit Photo'}).click();await expect(kid.locator('.toast')).toContainText('submitted');
 await parent.getByRole('button',{name:'Quests',exact:true}).click();await expect(parent.locator('.review-card').filter({hasText:'Read'})).toBeVisible({timeout:16000});const review=parent.locator('.review-card').filter({hasText:'Read'});await expect(review.locator('img')).toBeVisible();await parent.screenshot({animations:'disabled',path:'artifacts/audit-parent-review.png'});await review.getByRole('button',{name:'Approve',exact:true}).click();
 await expect(parent.locator('.confetti')).toHaveCount(0);await expect(parent.getByRole('dialog',{name:'Mission approved'})).toHaveCount(0);
 await expect(kid.getByRole('dialog',{name:'Mission approved'})).toBeVisible({timeout:16000});await kid.screenshot({animations:'disabled',path:'artifacts/audit-child-celebration.png'});await kid.getByRole('button',{name:'Reveal my rewards',exact:true}).first().click();await kid.getByRole('button',{name:/Awesome! Keep going/}).click();await kid.reload();await expect(kid.getByRole('dialog',{name:'Mission approved'})).toHaveCount(0);
 await kid.getByRole('button',{name:'Profile',exact:true}).click();await kid.locator('input[type=file]').setInputFiles('artifacts/audit-photo-empty.png');await kid.getByRole('button',{name:'Save my picture'}).click();await expect(kid.locator('.child-profile').getByRole('status')).toContainText('saved');await kid.screenshot({animations:'disabled',path:'artifacts/audit-child-profile.png'});
 await parent.getByRole('button',{name:'Children',exact:true}).click();let member=parent.locator('.family-management-row').filter({hasText:'Updated Imran'});await member.getByRole('button',{name:'Edit profile'}).click();let dialog=parent.getByRole('dialog',{name:'Edit child profile'});await dialog.getByLabel('Child name').fill('Imran Hero');await dialog.locator('select').selectOption('13');await dialog.getByRole('button',{name:'Save profile'}).click();await expect(parent.locator('.family-management-row').filter({hasText:'Imran Hero'})).toBeVisible();await parent.screenshot({animations:'disabled',path:'artifacts/audit-parent-family.png'});
 await parent.getByRole('button',{name:'Home',exact:true}).click();await parent.screenshot({animations:'disabled',path:'artifacts/audit-parent-home.png'});
 await kid.getByRole('button',{name:'Home',exact:true}).click();await kid.getByRole('button',{name:'Refresh tasks'}).click();await expect(kid.getByRole('heading',{name:/Let’s go, Imran Hero/})).toBeVisible();await kid.screenshot({animations:'disabled',path:'artifacts/audit-child-home.png'});
 await kid.getByRole('button',{name:'Quests',exact:true}).click();await kid.screenshot({animations:'disabled',path:'artifacts/audit-child-quests.png'});
 for(const page of [parent,kid]){await page.setViewportSize({width:320,height:720});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth||[...document.querySelectorAll('.phone-shell')].some(e=>e.scrollWidth>e.clientWidth||e.scrollLeft!==0)||[...document.querySelectorAll('.phone-shell,.app-header,.content')].some(e=>e.getBoundingClientRect().left<0));if(overflow)throw Error('Horizontal overflow or cropped shell at 320px');}
 if(issues.length)throw Error(issues.join('\n'));
 console.log('PASS real browsers + PHP/MySQL: preset in correct routine, photo upload and parent proof preview, approval with child-only celebration, persistent child avatar, parent profile edit, separate role UI, 320px layout.');
}finally{await browser.close();}
