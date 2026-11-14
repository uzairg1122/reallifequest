import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
let avatar=null,requests=[],suggestion='',savedPhoto=null,failReward=false,rewardCalls=0;
const issues=[];
const tasks=[
 ['teeth','Brush Your Teeth','Morning Routine','🪥','approved'],['bed','Make Your Bed','Morning Routine','🛏️','active'],
 ['dress','Get dressed','Morning Routine','👕','approved'],['school','Read a Book','School & Homework','📗','submitted'],
 ['tidy','Clean Bedroom Floor','Tidy & Order','🧹','active'],['sleep','Choose a Bedtime Story','Bedtime Wind-Down','📖','active'],
 ['puzzle','Help Sibling with Puzzle','Bonus','🧩','active'],['recycle','Organize Recycling Bin','Bonus','♻️','active'],['table','Set the Dinner Table','Bonus','🍽️','active'],
].map(([id,title,category,icon,status])=>({id,title,mission_title:title,category,icon,status,coins:40,xp:50,photo_required:0,description:'Complete this task and ask your parent to check.',assigned_to:'kid'}));
const rewards=[{id:'gaming',name:'30 Min Tablet Gaming',cost_coins:250,description:''},{id:'movie',name:'Friday Movie Night Pass',cost_coins:500,description:''},{id:'ice',name:'Ice Cream Parlor Trip',cost_coins:700,description:''},{id:'cookie',name:'Favorite Bakery Cookie',cost_coins:300,description:''},{id:'lego',name:'Lego Star Wars Millennium Falcon',cost_coins:2000,description:''}];
await context.addInitScript(()=>{localStorage.setItem('real_life_quest_api_token','reference-ui-test');localStorage.setItem('real_life_quest_api_user',JSON.stringify({id:'kid',displayName:'Leo',role:'child'}));localStorage.setItem('rlq_started','1');});
await context.route('**/api/**',async route=>{
 const path=new URL(route.request().url()).pathname,method=route.request().method();let data={};
 if(path==='/api/family')data={family:{id:'family',name:'Family'},members:[{id:'kid',display_name:'Leo',role:'child',coins:1250,xp:2320,level:5,stars:12,avatar_data:avatar}]};
 else if(path==='/api/tasks')data={tasks};
 else if(path==='/api/notifications')data={notifications:[]};
 else if(path==='/api/rewards')data={rewards,requests};
 else if(path==='/api/profile'&&method==='PATCH'){savedPhoto=route.request().postDataJSON().avatarData;avatar=savedPhoto;data={ok:true};}
 else if(path==='/api/suggestions'){suggestion=route.request().postDataJSON().name;data={ok:true};}
 else if(path.endsWith('/request')){rewardCalls++;if(failReward){await route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Please try your reward again.'})});return;}const reward=rewards.find(r=>path.includes(`/${r.id}/`));requests.push({id:'req-'+reward.id,reward_id:reward.id,name:reward.name,child_name:'Leo',cost_coins:reward.cost_coins,status:'pending'});data={id:'request'};}
 else throw Error(`Unexpected API ${method} ${path}`);
 await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
});
const page=await context.newPage();page.on('pageerror',e=>issues.push(e.message));
async function shot(name){await page.screenshot({path:`artifacts/reference-${name}.png`,animations:'disabled'});}
async function noOverflow(){const bad=await page.evaluate(()=>{const shell=document.querySelector('.phone-shell');return shell.scrollWidth>shell.clientWidth||shell.scrollLeft!==0||document.documentElement.scrollWidth>innerWidth||[...document.querySelectorAll('.bottom-nav button,.routine-card,.reward-row,.profile-stats button')].some(e=>e.scrollWidth>e.clientWidth+2);});if(bad)throw Error('Overflow');}
try{
 await page.goto('http://127.0.0.1:5173');await expect(page.locator('.profile-line h2')).toHaveText('Leo');
 await expect(page.locator('.routine-card')).toHaveCount(4);await expect(page.locator('.bottom-nav button')).toHaveCount(5);
 await expect(page.getByRole('progressbar',{name:'Approved routine progress'})).toHaveAttribute('aria-valuenow','2');
 await shot('home');await noOverflow();
 await page.getByRole('button',{name:'Bonus',exact:true}).click();await expect(page.locator('.child-bonus .quest-row')).toHaveCount(3);await expect(page.locator('.weekend-card')).not.toContainText('1.5');await shot('bonus');
 await page.getByRole('button',{name:/Suggest a Deed/}).click();const dialog=page.getByRole('dialog');await dialog.locator('input[name=name]').fill('Help water the plants');await dialog.locator('button[type=submit]').click();await expect(page.locator('.toast')).toContainText('sent');if(suggestion!=='Help water the plants')throw Error('Suggestion not sent');
 await page.getByRole('button',{name:'Vault',exact:true}).click();await expect(page.locator('.reward-row')).toHaveCount(5);await expect(page.locator('.vault-balance strong')).toHaveText('1,250');await shot('vault');
 await page.getByRole('button',{name:'Treats',exact:true}).click();await expect(page.locator('.reward-row')).toHaveCount(2);
 await page.getByRole('button',{name:'Goals',exact:true}).click();await expect(page.locator('.reward-row')).toHaveCount(1);await expect(page.locator('.reward-row')).toBeDisabled();
 await page.getByRole('button',{name:'All Rewards',exact:true}).click();failReward=true;await page.getByRole('button',{name:/Ask for reward: 30 Min/}).click();await expect(page.getByRole('status')).toContainText('try your reward again');await expect(page.locator('.vault-balance strong')).toHaveText('1,250');
 failReward=false;await page.getByRole('button',{name:/Ask for reward: 30 Min/}).click();await expect(page.getByRole('button',{name:/Waiting for parent: 30 Min/})).toBeDisabled();await expect(page.locator('.vault-balance strong')).toHaveText('1,250');if(rewardCalls!==2)throw Error('Duplicate reward request');
 await page.getByRole('button',{name:'Profile',exact:true}).click();await expect(page.getByRole('heading',{name:'My Hero Profile'})).toBeVisible();await expect(page.locator('.hero-level')).toHaveText('Level 5 Adventurer');await expect(page.getByRole('progressbar',{name:'Level progress'})).toHaveAttribute('aria-valuenow','320');await shot('profile');
 await page.locator('input[type=file]').setInputFiles('artifacts/reference-home.png');await page.getByRole('button',{name:'Save my picture'}).click();await expect(page.getByRole('status')).toContainText('saved');if(!savedPhoto?.startsWith('data:image/jpeg'))throw Error('Profile not saved');
 await page.getByRole('button',{name:'Home',exact:true}).click();await expect(page.locator('.avatar img')).toHaveAttribute('src',savedPhoto);await page.reload();await expect(page.locator('.avatar img')).toHaveAttribute('src',savedPhoto);
 await page.getByRole('button',{name:'Profile',exact:true}).click();await page.getByRole('button',{name:'Use default avatar'}).click();await page.getByRole('button',{name:'Save my picture'}).click();await expect(page.getByRole('status')).toContainText('saved');if(avatar!==null)throw Error('Default avatar not persisted');
 await page.getByRole('button',{name:/Settings Sound/}).click();await expect(page.getByRole('heading',{name:'Settings',exact:true})).toBeVisible();await shot('settings');
 await page.getByRole('button',{name:'Home',exact:true}).click();await page.getByRole('button',{name:/Morning Routine/}).click();await shot('routine');await expect(page.locator('.quest-row')).toHaveCount(3);
 await page.getByRole('button',{name:'Quests',exact:true}).click();await shot('quests');
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});for(const name of ['Home','Bonus','Vault','Profile']){await page.getByRole('button',{name,exact:true}).click();await noOverflow();await expect(page.getByRole('button',{name:'Profile',exact:true})).toBeInViewport();if(width===320)await shot(`${name.toLowerCase()}-320`);}}
 // Empty account still exposes all three child destinations, with honest empty states.
 tasks.splice(0);rewards.splice(0);requests=[];await page.reload();await page.getByRole('button',{name:'Bonus',exact:true}).click();await expect(page.locator('.bonus-empty')).toBeVisible();await shot('bonus-empty');await page.getByRole('button',{name:'Vault',exact:true}).click();await expect(page.locator('.wallet-empty')).toBeVisible();await shot('vault-empty');
 // Local family mode keeps its existing progress while saving the new profile photo.
 const localContext=await browser.newContext({viewport:{width:390,height:844}});
 await localContext.addInitScript(()=>localStorage.setItem('rlq_started','1'));
 const local=await localContext.newPage();await local.goto('http://127.0.0.1:5173');
 await local.getByRole('button',{name:'Profile',exact:true}).click();
 await expect(local.locator('.profile-picture-preview')).toHaveCSS('background-image',/adventure\.png/);
 await local.locator('input[type=file]').setInputFiles('artifacts/reference-home.png');await local.getByRole('button',{name:'Save my picture'}).click();await expect(local.getByRole('status')).toContainText('saved');
 const stored=await local.evaluate(()=>JSON.parse(localStorage.getItem('real_life_quest_state_v1_family')));if(stored.coins!==0||stored.quests.length!==12||!stored.avatarData?.startsWith('data:image/jpeg'))throw Error('Local family progress changed');
 await local.reload();await expect(local.locator('.profile-line .avatar img')).toHaveAttribute('src',stored.avatarData);
 if(issues.length)throw Error(issues.join('\n'));
 console.log('PASS: five child destinations, reference layouts at 320/390/768/1280px, bonus suggestions, reward filters/pending/failure/insufficient coins without debit, persisted profile upload/reset, empty accounts, no browser errors. API responses are deterministic test fixtures.');
}finally{await browser.close();}
