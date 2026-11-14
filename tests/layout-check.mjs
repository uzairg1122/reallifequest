import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const {parent}=JSON.parse(await readFile('artifacts/real-session.json','utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.addInitScript(s=>{localStorage.setItem('real_life_quest_api_token',s.token);localStorage.setItem('real_life_quest_api_user',JSON.stringify(s.user));localStorage.setItem('rlq_started','1');},parent);
 const page=await context.newPage();await page.goto('http://127.0.0.1:5173');
 await expect(page.getByRole('heading',{name:'Your family dashboard'})).toBeVisible();
 await page.setViewportSize({width:320,height:720});
 console.log(await page.evaluate(()=>[document.documentElement,document.body,...document.querySelectorAll('.app-surround,.phone-shell,.app-header,.content,.bottom-nav')].map(e=>({tag:e.className||e.tagName,x:e.getBoundingClientRect().x,width:e.getBoundingClientRect().width,scrollLeft:e.scrollLeft,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}))));
 await page.screenshot({path:'artifacts/layout-parent.png',animations:'disabled'});
}finally{await browser.close();}
