import {chromium,expect} from '@playwright/test';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:980}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173');
 await page.getByRole('button',{name:'Get Started'}).click();await page.getByRole('button',{name:'Skip',exact:true}).click();
 await page.getByRole('button',{name:/I'm a Parent/}).click();
 await expect(page.getByRole('heading',{name:'Let’s build your guild!'})).toBeVisible();
 const google=page.getByRole('button',{name:'Continue with Google',exact:true});await expect(google).toBeVisible();
 const create=await page.getByRole('button',{name:'Create Family'}).boundingBox();const button=await google.boundingBox();
 if(button.y<create.y+create.height)throw Error('Google button is not below Create Family');
 if(button.height<44)throw Error('Google touch target too small');
 await page.screenshot({path:'artifacts/google-parent-390.png',fullPage:true});
 await google.click();await expect(page.getByRole('alert')).toContainText('Open the Android app');await expect(google).toBeEnabled();
 await page.setViewportSize({width:320,height:920});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('320px horizontal overflow');
 await google.scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/google-parent-320.png',fullPage:true});
 await page.getByRole('button',{name:'Back',exact:true}).click();await page.getByRole('button',{name:/I'm a Kid/}).click();
 await expect(page.getByRole('button',{name:'Continue with Google'})).toHaveCount(0);
 if(errors.length)throw Error(errors.join('\n'));
 await context.close();console.log('PASS parent Google placement, 320px layout, desktop fallback, child isolation');
 const native=await browser.newContext({viewport:{width:390,height:920}});
 await native.addInitScript(()=>{
   window.androidBridge={};
   window.Capacitor={PluginHeaders:[{name:'ParentGoogleAuth',methods:[{name:'signIn',rtype:'promise'}]}],nativePromise:async()=>({idToken:'fixture-google-token'})};
 });
 let attempts=0;
 await native.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;let json={};let status=200;
   if(path==='/api/auth/google/challenge')json={nonce:'a'.repeat(64)};
   if(path==='/api/auth/google'){
     attempts++;const body=route.request().postDataJSON();
     assertFixture(body.idToken==='fixture-google-token'&&body.nonce==='a'.repeat(64),'native token/nonce forwarded');
     if(!body.password){status=409;json={error:'Confirm your existing account password'};}
     else if(body.password!=='correct-password'){status=401;json={error:'Existing account password is incorrect.'};}
     else json={user:{id:'existing-parent',displayName:'Returning Parent',role:'parent'},familyId:'same-family',token:'fixture-session'};
   }
   if(path==='/api/family')json={family:{id:'same-family'},members:[{id:'existing-parent',display_name:'Returning Parent',role:'parent'}]};
   if(path==='/api/tasks')json={tasks:[]};if(path==='/api/submissions')json={submissions:[]};if(path==='/api/notifications')json={notifications:[]};
   if(path==='/api/safety/consent')json={children:[],history:[],scopes:{}};if(path==='/api/safety/reports')json={reports:[]};
   await route.fulfill({status,json});
 });
 const n=await native.newPage();await n.goto('http://127.0.0.1:5173');
 await n.getByRole('button',{name:'Get Started'}).click();await n.getByRole('button',{name:'Skip',exact:true}).click();await n.getByRole('button',{name:/I'm a Parent/}).click();
 await n.getByRole('button',{name:'Continue with Google',exact:true}).click();await expect(n.getByLabel('Your existing account password')).toBeVisible();
 await n.getByLabel('Your existing account password').fill('wrong');await n.getByRole('button',{name:'Connect my existing account'}).click();await expect(n.getByRole('alert')).toContainText('incorrect');
 await n.getByLabel('Your existing account password').fill('correct-password');await n.getByRole('button',{name:'Connect my existing account'}).click();
 await expect(n.locator('.parent-dashboard')).toBeVisible();
 await expect.poll(()=>n.evaluate(()=>localStorage.getItem('real_life_quest_api_family'))).toBe('same-family');
 await n.reload();await expect(n.locator('.parent-dashboard')).toBeVisible();
 if(attempts!==3)throw Error('Unexpected Google login retry count');
 await native.close();console.log('PASS simulated native handoff, safe linking, password retry, session restored after reload');
}finally{await browser.close();}
function assertFixture(value,label){if(!value)throw Error(label);}
