import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const sessions=JSON.parse(await readFile('artifacts/real-session.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
const errors=[];
async function open(session){const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.addInitScript(s=>{localStorage.setItem('real_life_quest_api_token',s.token);localStorage.setItem('real_life_quest_api_user',JSON.stringify(s.user));localStorage.setItem('rlq_started','1');},session);const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5173');return page;}
try{
 const kid=await open(sessions.child),parent=await open(sessions.parent);
 await expect(kid.getByRole('dialog',{name:'Mission approved'})).toBeVisible();
 await kid.getByRole('button',{name:'Reveal my rewards',exact:true}).first().click();await kid.getByRole('button',{name:/Awesome! Keep going/}).click();
 await kid.getByRole('button',{name:'Profile',exact:true}).click();await kid.locator('input[type=file]').setInputFiles('artifacts/reference-home.png');await kid.getByRole('button',{name:'Save my picture'}).click();await expect(kid.locator('.child-profile').getByRole('status')).toContainText('saved');
 await parent.reload();await expect(parent.locator('.child-member-photo').first()).toHaveAttribute('src',/^data:image/);
 await kid.getByRole('button',{name:'Quests',exact:true}).click();await kid.getByRole('button',{name:/Browser toy mission/}).first().click();await kid.getByRole('button',{name:'Add Before & After'}).click();
 const submit=kid.getByRole('button',{name:'Submit Before & After'});await expect(submit).toBeDisabled();
 await kid.getByLabel('Choose before from gallery').setInputFiles('artifacts/reference-home.png');await expect(kid.getByAltText('Before photo preview')).toBeVisible();await expect(submit).toBeDisabled();
 await kid.getByRole('button',{name:'Save for later'}).click();await kid.reload();await kid.getByRole('button',{name:'Quests',exact:true}).click();await kid.getByRole('button',{name:/Browser toy mission/}).first().click();await kid.getByRole('button',{name:'Add Before & After'}).click();await expect(kid.getByAltText('Before photo preview')).toBeVisible();
 await kid.getByLabel('Choose after from gallery').setInputFiles('artifacts/reference-vault.png');await expect(submit).toBeEnabled();
 await kid.setViewportSize({width:320,height:740});await kid.screenshot({path:'artifacts/photo-before-after-320.png',animations:'disabled'});if(await kid.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.phone-shell').scrollWidth>document.querySelector('.phone-shell').clientWidth))throw Error('Proof layout overflow');
 await submit.click();await expect(kid.locator('.photo-proof')).toHaveCount(0);
 await parent.getByRole('button',{name:'Quests',exact:true}).click();const review=parent.locator('.review-card').filter({hasText:'Browser toy mission'});await expect(review).toBeVisible({timeout:16000});await expect(review.locator('.proof-thumb img')).toHaveCount(2);await parent.screenshot({path:'artifacts/photo-parent-review.png',animations:'disabled'});
 if(errors.length)throw Error(errors.join('\n'));console.log('PASS profile parent sync, before draft after reload, required pair, submission, parent two-photo review and 320px layout');
}finally{await browser.close();}
