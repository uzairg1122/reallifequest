import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const base='http://127.0.0.1:5173';
try{
 let members=[{id:'a',role:'child',display_name:'Ali',coins:0,xp:0,level:1,stars:0},{id:'s',role:'child',display_name:'Sara',coins:0,xp:0,level:1,stars:0}],tasks=[],deletes=0,passwordCalls=0;
 const errors=[];
 async function makePage(id,role){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(({id,role})=>{localStorage.setItem('real_life_quest_api_token',id);localStorage.setItem('real_life_quest_api_user',JSON.stringify({id,role,displayName:id==='s'?'Sara':'Parent'}));localStorage.setItem('rlq_started','1');},{id,role});
  await context.route('**/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;let data={};
   if(path==='/api/family')data={family:{id:'f'},members};
   if(path==='/api/notifications')data={notifications:[]};
   if(path==='/api/submissions')data={submissions:[]};
   if(path==='/api/tasks'&&req.method()==='GET')data={tasks:tasks.filter(t=>t.assigned_to===id)};
   if(path==='/api/tasks'&&req.method()==='POST'){const input=req.postDataJSON();tasks.push({id:'t'+tasks.length,assigned_to:input.childId,mission_title:input.missionTitle,status:'active',...input});data={id:tasks.at(-1).id};}
   if(path==='/api/account/password'){passwordCalls++;const input=req.postDataJSON();if(input.currentPassword!=='correct-password')return route.fulfill({status:422,json:{error:'Current password is incorrect.'}});data={ok:true};}
   if(path==='/api/family/delete-child'){deletes++;const input=req.postDataJSON();if(input.password!=='correct-password')return route.fulfill({status:422,json:{error:'Parent password is incorrect.'}});members=members.filter(m=>m.id!==input.childId);tasks=tasks.filter(t=>t.assigned_to!==input.childId);data={ok:true};}
   await route.fulfill({json:data});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);return page;
 }
 const parent=await makePage('p','parent'),child=await makePage('s','child');
 const board=parent.locator('.parent-task-board');
 await board.locator('select').selectOption('s');await board.getByRole('checkbox').first().check();await board.getByRole('button',{name:'Assign 1 selected tasks'}).click();
 await expect(board.getByRole('status')).toContainText('assigned to Sara');
 await child.getByRole('button',{name:'Refresh tasks'}).click();
 await expect(child.getByRole('button',{name:/Brush Your Teeth/})).toBeVisible();
 await child.getByRole('button',{name:'Quests',exact:true}).click();await expect(child.getByRole('button',{name:/Brush Your Teeth/})).toBeVisible();
 await child.getByRole('button',{name:'Home',exact:true}).click();
 await board.getByRole('button',{name:'Custom task',exact:true}).click();await board.getByLabel('Task name').fill('Water the plants');await board.getByLabel('Instructions').fill('Water both pots');await board.getByRole('button',{name:'Assign custom task'}).click();
 await expect(child.getByRole('button',{name:/Water the plants/})).toBeVisible({timeout:16000});
 await child.screenshot({path:'artifacts/child-assigned-tasks.png'});
 await parent.getByRole('button',{name:'Change my password'}).click();let dialog=parent.getByRole('dialog',{name:'Change password',exact:true});
 await dialog.getByLabel('Current password',{exact:true}).fill('wrong-password');await dialog.getByLabel('New password',{exact:true}).fill('new-password');await dialog.getByLabel('Confirm new password').fill('mismatch-password');await dialog.getByRole('button',{name:'Save password'}).click();await expect(dialog.getByRole('alert')).toContainText('do not match');if(passwordCalls)throw Error('Mismatch called API');
 await dialog.getByLabel('Confirm new password').fill('new-password');await dialog.getByRole('button',{name:'Save password'}).click();await expect(dialog.getByRole('alert')).toContainText('incorrect');await dialog.getByLabel('Current password',{exact:true}).fill('correct-password');await dialog.getByRole('button',{name:'Save password'}).click();await expect(dialog).not.toBeVisible();
 const sara=parent.locator('.family-management-row').filter({hasText:'Sara'});await sara.getByRole('button',{name:'Delete profile'}).click();dialog=parent.getByRole('dialog',{name:'Delete child profile'});await expect(dialog).toContainText('Sara');await dialog.getByRole('button',{name:'Cancel'}).click();if(deletes)throw Error('Cancel called delete API');
 await sara.getByRole('button',{name:'Delete profile'}).click();await dialog.getByLabel('Your parent password').fill('wrong-password');await dialog.getByRole('button',{name:'Permanently delete profile'}).click();await expect(dialog.getByRole('alert')).toContainText('incorrect');await dialog.getByLabel('Your parent password').fill('correct-password');await dialog.getByRole('button',{name:'Permanently delete profile'}).click();await expect(sara).toHaveCount(0);await expect(parent.locator('.family-management-row').filter({hasText:'Ali'})).toHaveCount(1);
 await expect(board.locator('select')).toHaveValue('a');
 await parent.locator('.parent-account').scrollIntoViewIfNeeded();await parent.screenshot({path:'artifacts/parent-account-controls.png'});
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS: two browser sessions, preset/custom visibility on child Home/Quests, polling, named recipient, password validation, delete cancellation/error/success and surviving child selection. API mocked.');
}finally{await browser.close();}
