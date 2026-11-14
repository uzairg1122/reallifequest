import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
let requests=[];
const tasks=[{id:'done',assigned_to:'kid',title:'Brush Your Teeth',mission_title:'Brush Your Teeth',category:'Morning Routine',icon:'🪥',coins:30,xp:45,status:'approved'},{id:'waiting',assigned_to:'kid',title:'Make Your Bed',mission_title:'Make Your Bed',category:'Morning Routine',icon:'🛏️',coins:20,xp:30,status:'submitted'}];
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(()=>{localStorage.setItem('real_life_quest_api_token','card-test');localStorage.setItem('real_life_quest_api_user',JSON.stringify({id:'parent',displayName:'Dad',role:'parent'}));localStorage.setItem('rlq_started','1');});
 await context.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;let data={};
  if(path==='/api/family')data={family:{id:'family',name:'Our Family'},members:[{id:'parent',role:'parent',display_name:'Dad'},{id:'kid',role:'child',display_name:'Imran',coins:30,xp:45},{id:'other',role:'child',display_name:'Sara',coins:0,xp:0}]};
  if(path==='/api/tasks'){if(route.request().method()==='POST'){const input=route.request().postDataJSON();requests.push(input);tasks.push({...input,id:`new-${requests.length}`,assigned_to:input.childId,mission_title:input.title,status:'active'});data={id:`new-${requests.length}`};}else data={tasks};}
  if(path==='/api/submissions')data={submissions:[]};if(path==='/api/notifications')data={notifications:[]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();await page.goto('http://127.0.0.1:5173');await expect(page.getByRole('heading',{name:'Your family dashboard'})).toBeVisible();
 const board=page.locator('.parent-task-board');await expect(board.locator('.parent-preset-card')).toHaveCount(6);await expect(board.locator('.invite-task-list')).toHaveCount(0);
 const teeth=board.locator('.parent-preset-card').filter({hasText:'Brush Your Teeth'});await teeth.click();await expect(teeth.getByRole('checkbox')).toBeChecked();await expect(teeth).toHaveClass(/is-selected/);
 await board.getByRole('button',{name:'Bedtime Wind-Down',exact:true}).click();await expect(board.locator('.parent-preset-card')).toHaveCount(5);
 await board.locator('.parent-preset-card').filter({hasText:'Choose a Bedtime Story'}).click();await expect(board.locator('.parent-assign-summary')).toContainText('2 selected');
 await board.getByRole('button',{name:'Morning Routine',exact:true}).click();await expect(teeth.getByRole('checkbox')).toBeChecked();
 await board.locator('.parent-routine-heading').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/parent-preset-cards.png',animations:'disabled'});
 await board.getByLabel('Find a task').fill('recycle');await expect(board.locator('.parent-task-empty').first()).toContainText('No matching');
 await board.getByLabel('Find a task').fill('Recycling');await expect(board.locator('.parent-preset-card')).toHaveCount(1);
 await board.getByRole('button',{name:'Tidy & Order',exact:true}).click();await expect(board.getByLabel('Find a task')).toHaveValue('');await expect(board.locator('.parent-preset-card')).toHaveCount(4);
 await board.getByLabel('Assign to',{exact:true}).selectOption('other');await board.getByRole('button',{name:'Assign 2 selected tasks'}).click();await expect(board.getByRole('status')).toContainText('2 missions assigned to Sara');
 if(requests.length!==2||requests.some(r=>r.childId!=='other')||requests[0].icon!=='🪥'||requests[1].icon!=='📖')throw Error('Selection payload regression');await expect(board.locator('.parent-assign-summary')).toContainText('0 selected');
 await board.getByLabel('Assign to',{exact:true}).selectOption('kid');await expect(board.locator('.parent-assigned-card.is-completed')).toContainText('Completed');await expect(board.locator('.parent-assigned-card.is-waiting')).toContainText('Waiting for your review');await board.locator('.assigned-history').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/parent-assigned-cards.png',animations:'disabled'});
 await page.setViewportSize({width:320,height:720});await board.getByRole('button',{name:'Morning Routine',exact:true}).click();await board.locator('.parent-routine-heading').scrollIntoViewIfNeeded();
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('.content').scrollWidth>document.querySelector('.content').clientWidth))throw Error('Horizontal overflow');await page.screenshot({path:'artifacts/parent-preset-cards-320.png',animations:'disabled'});
 await board.getByRole('checkbox',{name:'Brush Your Teeth',exact:true}).focus();await page.keyboard.press('Space');await expect(board.getByRole('checkbox',{name:'Brush Your Teeth',exact:true})).toBeChecked();
 console.log('PASS parent task cards: categories, multi-category selection, search/clear, correct child and icon payloads, approved/waiting cards, keyboard selection, 320px layout. API fixtures only.');
}finally{await browser.close();}
