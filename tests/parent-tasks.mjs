import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const assigned=[];let notices=[];
 await page.addInitScript(()=>{localStorage.setItem('real_life_quest_api_token','test');localStorage.setItem('real_life_quest_api_user',JSON.stringify({id:'p',role:'parent',displayName:'Parent'}));});
 await page.route('**/api/**',async r=>{const path=new URL(r.request().url()).pathname;let data={};
 if(path==='/api/family')data={family:{id:'f'},members:[{id:'a',role:'child',display_name:'Ali'},{id:'s',role:'child',display_name:'Sara'}]};
 if(path==='/api/submissions')data={submissions:[]};
 if(path==='/api/notifications')data={notifications:notices};
 if(path==='/api/tasks'){assigned.push(r.request().postDataJSON());data={id:'task'};}
 await r.fulfill({json:data});});
 await page.goto('http://127.0.0.1:5173');
 const board=page.locator('.parent-task-board');
 await board.locator('select').selectOption('s');
 await board.getByRole('checkbox').first().check();
 await board.getByRole('button',{name:'Assign 1 selected tasks'}).click();
 await expect(board.getByRole('status')).toContainText('1 mission assigned');
 if(assigned[0].childId!=='s')throw Error('Wrong child for preset');
 await board.getByRole('button',{name:'Custom task',exact:true}).click();
 await board.getByLabel('Task name').fill('Water the plants');await board.getByLabel('Instructions').fill('Water both pots.');
 await board.getByRole('button',{name:'Assign custom task'}).click();
 await expect.poll(()=>assigned.length).toBe(2);
 if(assigned[1].title!=='Water the plants'||assigned[1].childId!=='s')throw Error('Wrong custom payload');
 notices=[{id:'new',title:'Mission ready for review',body:'Room clean',created_at:new Date().toISOString()}];
 await expect(page.locator('.toast')).toContainText('Mission ready for review',{timeout:15000});
 console.log('PASS preset/custom assignment to selected child and incoming notification toast');
}finally{await browser.close();}
