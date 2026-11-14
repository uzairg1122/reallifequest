import assert from 'node:assert/strict';
const base='http://127.0.0.1:8081/api';
async function call(path,token,body,method=body?'POST':'GET',expected=200){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const text=await r.text();let result;try{result=JSON.parse(text);}catch{throw Error(path+': non-JSON '+text.slice(0,300));}
 assert.equal(r.status,expected,`${path}: [${r.status}] ${text}`);return result;
}
const stamp=Date.now(),password='social-password-123';
// Primary parent + one child
const p1=await call('/auth/register',null,{email:`p1-${stamp}@example.test`,password,displayName:'Primary Parent'},'POST',201);
const task={title:'Tidy up',missionTitle:'Tidy up',description:'Put toys away',category:'Tidy & Order',icon:'🧹',days:'both',coins:10,xp:25,difficulty:'medium'};
const invite=await call('/families/pairing-code',p1.token,{childName:'League Kid',childAge:11,tasks:Array.from({length:5},(_,i)=>({...task,title:i?`Starter ${i}`:task.title}))});
const c1=await call('/auth/register-child',null,{displayName:`League Kid ${stamp}`,age:11,code:invite.code,pin:'2468'},'POST',201);

// Weekly league: child is auto-placed into Bronze (division 3), themed, with the three divisions
const league=await call('/league',p1.token);
assert.equal(league.week.length,8,'iso week key is 8 chars');
assert.ok(league.theme&&typeof league.theme.title==='string'&&league.theme.title.length>0,'weekly theme present');
assert.equal(league.divisions['3'],'Bronze');assert.equal(league.divisions['1'],'Gold');
assert.ok(Array.isArray(league.leagues)&&league.leagues.length>=1,'at least one child league');
const kidLeague=league.leagues.find(l=>l.childName.startsWith('League Kid'));
assert.ok(kidLeague,'child appears in league');assert.equal(kidLeague.division,3);assert.equal(kidLeague.divisionName,'Bronze');

// Share card + referral code
const share=await call('/families/share',p1.token);
assert.ok(/^[0-9A-F]{6}$/.test(share.referralCode),`referral code format: ${share.referralCode}`);
assert.ok(share.referralUrl.includes('?ref='+share.referralCode),'referral url carries the code');
assert.equal(share.referredCount,0,'no referrals yet');
assert.ok(share.theme&&share.theme.title,'share carries weekly theme');
assert.ok(share.totals&&Number(share.totals.children)>=1,'totals count the child');

// Co-parent invite (primary only) → grouped XXX-XXX display + deep link
const cpCode=await call('/families/co-parent-code',p1.token,{},'POST');
assert.ok(/^\d{6}$/.test(cpCode.code),`co-parent code is 6 digits: ${cpCode.code}`);
assert.ok(/^\d{3}-\d{3}$/.test(cpCode.codeDisplay),`grouped display: ${cpCode.codeDisplay}`);
assert.ok(cpCode.inviteUrl.includes('?coparent='+cpCode.code),'co-parent deep link');

// Co-parent registration joins the SAME family as a second parent
const cp=await call('/auth/register-coparent',null,{email:`cp-${stamp}@example.test`,password,displayName:'Co Parent',code:cpCode.code},'POST',201);
assert.equal(cp.user.role,'parent');assert.equal(cp.familyId,p1.familyId);

// Parents roster: primary sees two, viewerIsPrimary true; co-parent sees viewerIsPrimary false
const roster=await call('/families/parents',p1.token);
assert.equal(roster.parents.length,2,'primary + co-parent');assert.equal(roster.viewerIsPrimary,true);
assert.equal(roster.parents.filter(p=>p.isPrimary).length,1,'exactly one primary');
const cpRoster=await call('/families/parents',cp.token);assert.equal(cpRoster.viewerIsPrimary,false);

// Permission matrix: co-parent may manage (create rewards) but NOT do primary-only destructive ops
await call('/rewards',cp.token,{name:'Movie night',description:'Together',cost:5},'POST',201);
await call('/families/co-parent-code',cp.token,{},'POST',403); // co-parent cannot invite
await call('/family/delete-child',cp.token,{childId:c1.user.id,password},'POST',403); // co-parent cannot delete a child

// Primary removes the co-parent
await call('/families/remove-coparent',p1.token,{coParentId:cp.user.id},'POST');
assert.equal((await call('/families/parents',p1.token)).parents.length,1,'co-parent removed');
await call('/family',cp.token,null,'GET',403); // removed co-parent has no family anymore

// Referral capture on registration → referredCount increments for the referrer
await call('/auth/register',null,{email:`ref-${stamp}@example.test`,password,displayName:'Referred Parent',ref:share.referralCode},'POST',201);
assert.equal((await call('/families/share',p1.token)).referredCount,1,'referral counted');

// Invite brute-force lockout: >10 attempts with a bad (but well-formed) code → 429
for(let i=0;i<11;i++){
 await call('/auth/register-child',null,{displayName:'Nope',age:10,code:'000000',pin:'1111'},'POST',i<10?422:429);
}
console.log('PASS real PHP/MariaDB social: weekly league placement + theme, share card + referral code, co-parent invite/join/roster, permission matrix (manage vs primary-only), co-parent removal, referral capture, invite brute-force lockout.');
