import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});let request;
 await page.route('**/api/**',async route=>{const path=new URL(route.request().url()).pathname;let body={};if(path==='/api/auth/child-login'){request=route.request().postDataJSON();body={token:'child-token',user:{id:'c1',displayName:'Imran',role:'child',age:11}};}if(path==='/api/family')body={family:{id:'f'},members:[{id:'c1',role:'child',display_name:'Imran',coins:0,xp:0,level:1,stars:0}]};if(path==='/api/tasks')body={tasks:[]};if(path==='/api/notifications')body={notifications:[]};await route.fulfill({json:body});});
 await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Get Started'}).click();await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('button',{name:"I'm a Kid"}).click();
 await page.getByLabel('Your name').fill('Imran');await page.getByLabel('Child PIN').fill('1234');await page.locator('select[name=action]').selectOption('login');await page.getByRole('button',{name:'Join family'}).click();
 if(request.displayName!=='Imran'||request.pin!=='1234')throw Error('Child PIN login payload incorrect');await expect(page.getByRole('button',{name:'Home',exact:true})).toBeVisible();
 console.log('PASS child name + PIN login');
}finally{await browser.close();}
