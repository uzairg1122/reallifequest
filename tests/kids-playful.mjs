import {chromium, expect} from '@playwright/test';

// Isolated API fixtures: this checks presentation and event wiring, not server payment rules.
const browser = await chromium.launch({channel: 'msedge', headless: true});
const issues = [];
const baseURL = process.env.RLQ_PREVIEW_URL || 'http://127.0.0.1:5173';
const makeTasks = () => [
  ['bed', 'Make Your Bed', 'Morning Routine', '🛏️', 'active'],
  ['book', 'Read a Book', 'School & Homework', '📗', 'approved'],
  ['tidy', 'Put Toys Away', 'Tidy & Order', '🧸', 'active'],
  ['story', 'Choose a Bedtime Story', 'Bedtime Wind-Down', '📖', 'active'],
  ['kind', 'Help Sibling with Puzzle', 'Bonus', '🧩', 'active'],
].map(([id, title, category, icon, status]) => ({
  id, title, mission_title: title, category, icon, status, coins: 40, xp: 50,
  photo_required: 0, photo_mode: 'optional', description: 'Finish your mission and ask your parent to check.',
  assigned_to: 'kid', family_id: 'family', created_by: 'parent',
}));

async function open(role = 'child', reducedMotion = 'no-preference') {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion});
  context.setDefaultTimeout(10000);
  const fixture = {tasks: makeTasks(), coins: 120, xp: 320, notices: [], failSubmit: false, submitCalls: 0, reads: 0};
  await context.addInitScript(role => {
    localStorage.setItem('real_life_quest_api_token', 'kids-playful-fixture');
    localStorage.setItem('real_life_quest_api_user', JSON.stringify({
      id: role === 'child' ? 'kid' : 'parent', displayName: role === 'child' ? 'Leo' : 'Dad', role,
    }));
    localStorage.setItem('rlq_started', '1');
    if (localStorage.getItem('rlq_kids_sound') === null) localStorage.setItem('rlq_kids_sound', 'on');
    window.__kidsAudio = {contexts: 0, oscillators: 0, buffers: 0, speech: []};
    if (window.AudioContext) {
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = new Proxy(NativeAudioContext, {construct(Target, args) {
        const audio = new Target(...args);
        window.__kidsAudio.contexts++;
        for (const [method, counter] of [['createOscillator', 'oscillators'], ['createBufferSource', 'buffers']]) {
          const original = audio[method].bind(audio);
          audio[method] = (...values) => { window.__kidsAudio[counter]++; return original(...values); };
        }
        return audio;
      }});
    }
    if (window.speechSynthesis) {
      Object.defineProperty(window.speechSynthesis, 'speak', {configurable: true, value: utterance => {
        window.__kidsAudio.speech.push(utterance.text);
      }});
    }
  }, role);
  await context.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    let data;
    if (path === '/api/family') data = {family: {id: 'family', name: 'Our family'}, members: [
      {id: 'kid', display_name: 'Leo', role: 'child', coins: fixture.coins, xp: fixture.xp, level: 1, stars: 1, age: 8},
      {id: 'parent', display_name: 'Dad', role: 'parent', coins: 0, xp: 0, level: 1, stars: 0},
    ]};
    else if (path === '/api/tasks' && method === 'GET') { fixture.reads++; data = {tasks: fixture.tasks}; }
    else if (path === '/api/notifications') data = {notifications: fixture.notices};
    else if (path === '/api/submissions') data = {submissions: []};
    else if (path === '/api/safety/consent') data = {children: [], history: [], scopes: {}};
    else if (path === '/api/safety/reports') data = {reports: []};
    else if (path === '/api/rewards') data = {rewards: [
      {id: 'ice', name: 'Ice Cream Trip', cost_coins: 100, description: 'A family treat.'},
      {id: 'movie', name: 'Movie Night', cost_coins: 250, description: 'Choose the movie together.'},
    ], requests: []};
    else if (path === '/api/tasks/bed/submit' && method === 'POST') {
      fixture.submitCalls++;
      if (fixture.failSubmit) {
        await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: 'Please try submitting again.'})});
        return;
      }
      fixture.tasks.find(task => task.id === 'bed').status = 'submitted';
      data = {submissionId: 'submitted-bed'};
    } else throw Error(`Unexpected API ${method} ${path}`);
    await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(data)});
  });
  const page = await context.newPage();
  page.on('pageerror', error => issues.push(error.message));
  await page.goto(baseURL);
  if (role === 'child') await expect(page.locator('.profile-line h2')).toHaveText('Leo');
  else await expect(page.getByRole('heading', {name: 'Your family dashboard'})).toBeVisible();
  return {page, fixture, context};
}

async function shot(page, name) {
  await page.screenshot({path: `artifacts/kids-playful-${name}.png`, animations: 'disabled'});
}
async function noOverflow(page, location) {
  const bad = await page.evaluate(() => {
    const shell = document.querySelector('.phone-shell');
    const controls = [...document.querySelectorAll('.bottom-nav button,.routine-card,.reward-row,.profile-stats button,.quest-row')];
    return !shell || shell.scrollWidth > shell.clientWidth + 1 || shell.scrollLeft !== 0 ||
      document.documentElement.scrollWidth > innerWidth + 1 || controls.some(element => element.scrollWidth > element.clientWidth + 2);
  });
  expect(bad, `No horizontal overflow on ${location}`).toBe(false);
}
async function audioSnapshot(page) {
  return page.evaluate(() => ({...window.__kidsAudio, speech: [...window.__kidsAudio.speech]}));
}
async function openSettings(page) {
  await page.getByRole('button', {name: 'Home', exact: true}).click();
  await page.getByRole('button', {name: 'Settings', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Settings', exact: true})).toBeVisible();
}
async function assertReducedMotion(page) {
  const moving = await page.locator('.kids-mode').evaluate(root => [root, ...root.querySelectorAll('*')].flatMap(element =>
    [null, '::before', '::after'].flatMap(pseudo => {
      const style = getComputedStyle(element, pseudo);
      const duration = style.animationDuration.split(',').some(value => parseFloat(value) > 0.01);
      const name = style.animationName;
      return name !== 'none' && duration ? [`${element.className}${pseudo || ''}: ${name}`] : [];
    })
  ));
  expect(moving, 'Reduced motion removes continuing decorative motion').toEqual([]);
}

try {
  const {page, fixture} = await open();
  await expect(page.locator('.phone-shell')).toHaveClass(/\bkids-mode\b/);
  await expect(page.locator('.bottom-nav button')).toHaveCount(5);
  for (const name of ['Home', 'Quests', 'Bonus', 'Vault', 'Profile']) {
    await page.getByRole('button', {name, exact: true}).click();
    await noOverflow(page, `${name} at 390px`);
    await shot(page, name.toLowerCase());
  }
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({width, height: 844});
    for (const name of ['Home', 'Quests', 'Bonus', 'Vault', 'Profile']) {
      await page.getByRole('button', {name, exact: true}).click();
      await noOverflow(page, `${name} at ${width}px`);
      await expect(page.getByRole('button', {name: 'Profile', exact: true})).toBeInViewport();
      if (width === 320) await shot(page, `${name.toLowerCase()}-320`);
    }
  }
  await page.setViewportSize({width: 390, height: 844});

  // The preference survives reload and prevents both generated sound and speech.
  await openSettings(page);
  let soundSwitch = page.getByRole('switch', {name: 'Sound & cheers', exact: true});
  await expect(soundSwitch).toHaveAttribute('aria-checked', 'true');
  await soundSwitch.click();
  await expect(soundSwitch).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('rlq_kids_sound'))).toBe('off');
  await page.reload();
  await expect(page.locator('.profile-line h2')).toHaveText('Leo');
  await openSettings(page);
  soundSwitch = page.getByRole('switch', {name: 'Sound & cheers', exact: true});
  await expect(soundSwitch).toHaveAttribute('aria-checked', 'false');
  const mutedBefore = await audioSnapshot(page);
  const trySound = page.getByRole('button', {name: /Try celebration sound/});
  if (await trySound.isEnabled()) await trySound.click();
  await page.getByRole('button', {name: 'Home', exact: true}).click();
  await page.getByRole('button', {name: 'Quests', exact: true}).click();
  expect(await audioSnapshot(page)).toEqual(mutedBefore);

  // A failed request must not cheer, mark complete, or grant a reward.
  fixture.failSubmit = true;
  await page.getByRole('button', {name: /Make Your Bed/}).click();
  await page.getByRole('dialog').getByRole('button', {name: /I’ve Finished/}).click();
  await expect(page.locator('.toast')).toContainText('Please try submitting again.');
  await expect(page.locator('.toast.kid-cheer')).toHaveCount(0);
  await expect(page.locator('.loot-card')).toHaveCount(0);
  expect(fixture.tasks[0].status).toBe('active');
  expect(fixture.coins).toBe(120);
  expect(await audioSnapshot(page)).toEqual(mutedBefore);

  // A submitted mission gets encouragement; parent approval still controls earnings.
  fixture.failSubmit = false;
  await page.getByRole('dialog').getByRole('button', {name: /I’ve Finished/}).click();
  const cheer = page.locator('.toast.kid-cheer');
  await expect(cheer).toContainText('High five, hero!');
  await expect(cheer).toContainText(/Quest submitted/i);
  await expect(cheer).toContainText(/parent/i);
  await expect(page.locator('.quest-row.waiting').filter({hasText: 'Make Your Bed'})).toBeVisible();
  await expect(page.locator('.loot-card')).toHaveCount(0);
  await shot(page, 'submitted');
  expect(fixture.submitCalls).toBe(2);
  expect(await audioSnapshot(page)).toEqual(mutedBefore);
  await page.getByRole('button', {name: 'Home', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Rewards wallet', exact: true})).toContainText('120');
  await expect(page.locator('.xp')).toContainText('320 / 500');

  await openSettings(page);
  await page.getByRole('switch', {name: 'Sound & cheers', exact: true}).click();
  expect(await page.evaluate(() => localStorage.getItem('rlq_kids_sound'))).toBe('on');
  const beforePreview = await audioSnapshot(page);
  await page.getByRole('button', {name: /Try celebration sound/}).click();
  await expect.poll(async () => {
    const current = await audioSnapshot(page);
    return current.oscillators + current.buffers > beforePreview.oscillators + beforePreview.buffers;
  }, {message: 'The explicit sound preview starts audio'}).toBe(true);
  await page.getByRole('button', {name: 'Home', exact: true}).click();

  // A new server approval, fetched via the normal refresh action, unlocks the real amounts.
  fixture.tasks[0].status = 'approved';
  fixture.coins += 40;
  fixture.xp += 50;
  fixture.notices = [{id: 'approved-bed', type: 'task_approved', title: 'Mission approved!',
    body: '+40 coins and +50 XP earned.', created_at: '2026-09-22 10:00:00'}];
  await page.getByRole('button', {name: 'Refresh tasks', exact: true}).click();
  const approval = page.getByRole('dialog', {name: 'Mission approved'});
  await expect(approval).toBeVisible();
  await expect(page.getByRole('button', {name: 'Rewards wallet', exact: true})).toContainText('160');
  await expect(page.locator('.xp')).toContainText('370 / 500');
  await approval.getByRole('button', {name: 'Reveal my rewards', exact: true}).first().click();
  await expect(approval.locator('.loot-reward.gold strong')).toHaveText('+40');
  await expect(approval.locator('.loot-reward.violet strong')).toHaveText('+50');
  const revealed = await audioSnapshot(page);
  await approval.getByRole('button', {name: 'Rewards revealed', exact: true}).click();
  expect(await audioSnapshot(page)).toEqual(revealed);
  expect(fixture.coins).toBe(160);
  await shot(page, 'approved');
  await approval.getByRole('button', {name: /Awesome/}).click();
  await expect(page.locator('.loot-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.profile-line h2')).toHaveText('Leo');
  await expect(page.getByRole('button', {name: 'Rewards wallet', exact: true})).toContainText('160');
  await expect(page.locator('.loot-card')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('rlq_win_kid_approved-bed'))).toBe('seen');

  const {page: reduced} = await open('child', 'reduce');
  for (const name of ['Home', 'Quests', 'Bonus', 'Vault', 'Profile']) {
    await reduced.getByRole('button', {name, exact: true}).click();
    await assertReducedMotion(reduced);
  }
  const {page: parent} = await open('parent');
  await expect(parent.locator('.kids-mode')).toHaveCount(0);
  await expect(parent.locator('.loot-card,.kid-cheer')).toHaveCount(0);
  await noOverflow(parent, 'parent dashboard');
  if (issues.length) throw Error(issues.join('\n'));
  console.log('PASS kids UI fixtures: five destinations at 320/390/768/1280px, reduced motion, persistent mute and audio preview, failure without cheering/payment, submitted encouragement without payment, server approval with exact rewards and once-only reveal, dismissal/reload, and parent isolation.');
} finally {
  await browser.close();
}
