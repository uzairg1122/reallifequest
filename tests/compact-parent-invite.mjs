import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
let children=[],inviteCount=0;
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>{localStorage.setItem('rlq_started','1');localStorage.setItem('real_life_quest_api_token','invite-ui-test');localStorage.setItem('real_life_quest_api_user',JSON.stringify({id:'p',displayName:'Dad',role:'parent'}));});
await context.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname;let data={};
 if(path==='/api/family')data={family:{id:'f'},members:[{id:'p',display_name:'Dad',role:'parent'},...children]};
 if(path==='/api/submissions')data={submissions:[]};if(path==='/api/tasks')data={tasks:[]};if(path==='/api/notifications')data={notifications:[]};
 if(path==='/api/families/pairing-code'){inviteCount++;data={code:'123456'};}
 await route.fulfill({json:data});
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('.parent-invite-card')).toBeVisible();await page.screenshot({path:'artifacts/invite-before-join.png'});
 await page.getByRole('button',{name:'Invite your kid',exact:true}).click();await page.getByLabel('Child name',{exact:true}).fill('Ali');await page.getByRole('button',{name:/Create invite/}).click();await expect(page.locator('.pairing-code')).toHaveText('123456');await page.getByRole('button',{name:'Done',exact:true}).click();
 await expect(page.locator('.parent-invite-card')).toBeVisible();if(inviteCount!==1)throw Error('Invite was not created');
 children=[{id:'kid',display_name:'Ali',role:'child',coins:30,xp:45,level:1,stars:1}];
 await expect(page.locator('.parent-invite-card')).toHaveCount(0,{timeout:16000});await expect(page.locator('.parent-children-card')).toContainText('Ali');await expect(page.locator('.parent-children-card .inline-invite-button')).toBeVisible();await page.screenshot({path:'artifacts/invite-after-join.png'});
 await page.getByRole('button',{name:'Invite another child',exact:true}).click();await expect(page.getByRole('heading',{name:'Invite your child'})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.reload();await expect(page.locator('.parent-children-card')).toContainText('Ali');await expect(page.locator('.parent-invite-card')).toHaveCount(0);
 await page.setViewportSize({width:320,height:720});await page.screenshot({path:'artifacts/invite-after-join-320.png'});
 const b=await page.locator('.inline-invite-button').boundingBox();if(b.height>50)throw Error('Invite button is not compact');
 if(await page.evaluate(()=>document.querySelector('.phone-shell').scrollWidth>document.querySelector('.phone-shell').clientWidth))throw Error('Overflow');
 await page.getByRole('button',{name:'Children',exact:true}).click();await expect(page.locator('.family-invite-toolbar .inline-invite-button')).toBeVisible();await page.getByRole('button',{name:'Invite another child',exact:true}).click();await expect(page.getByRole('heading',{name:'Invite your child'})).toBeVisible();await page.getByRole('button',{name:'Close',exact:true}).click();
 children=[];await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.locator('.parent-invite-card')).toBeVisible({timeout:16000});
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: big invite only before joining, created invite stays visible, joined-child polling transition, compact action works from dashboard/Children, reload persistence, last-child removal restores onboarding, 320px layout. API fixtures.');
}finally{await browser.close();}
