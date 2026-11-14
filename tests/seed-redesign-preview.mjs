// Seeds a realistic parent family against the local API so the parent dashboard
// can be reviewed with real content. Disposable: uses the local audit DB only.
const BASE = 'http://127.0.0.1:8081';

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return json;
}

const TASKS = [
  { title: 'Make your bed', missionTitle: 'Make your bed', description: 'Pull up the covers and plump the pillows.', coins: 15, xp: 20, category: 'Morning Routine', icon: '🛏️', days: 'both' },
  { title: 'Brush teeth morning', missionTitle: 'Brush teeth morning', description: 'Two whole minutes with the toothbrush.', coins: 15, xp: 20, category: 'Morning Routine', icon: '🪥', days: 'both' },
  { title: 'Get dressed for school', missionTitle: 'Get dressed for school', description: 'Pick clothes and get them on without help.', coins: 15, xp: 20, category: 'Morning Routine', icon: '👕', days: 'Weekdays' },
  { title: 'Homework done', missionTitle: 'Homework done', description: 'Finish the school work before dinner.', coins: 25, xp: 35, category: 'School & Homework', icon: '📚', days: 'Weekdays' },
  { title: 'Read for 20 minutes', missionTitle: 'Read for 20 minutes', description: 'Any book you like.', coins: 20, xp: 25, category: 'School & Homework', icon: '📖', days: 'both' },
  { title: 'Tidy your room', missionTitle: 'Tidy your room', description: 'Put everything back where it lives.', coins: 20, xp: 25, category: 'Tidy & Order', icon: '🧹', days: 'both' },
  { title: 'Brush teeth bedtime', missionTitle: 'Brush teeth bedtime', description: 'The last job before lights out.', coins: 15, xp: 20, category: 'Bedtime Wind-Down', icon: '🌙', days: 'both' },
  { title: 'Load the dishwasher', missionTitle: 'Load the dishwasher', description: 'Help stack the dishes safely.', coins: 25, xp: 35, category: 'Bonus', icon: '🍽️', days: 'Once' },
  { title: 'Walk the dog', missionTitle: 'Walk the dog', description: 'Take the dog around the block.', coins: 30, xp: 40, category: 'Bonus', icon: '🐕', days: 'Weekends' },
  { title: 'Water the plants', missionTitle: 'Water the plants', description: 'Check each pot and water if dry.', coins: 15, xp: 20, category: 'Bonus', icon: '🪴', days: 'Once' },
];

const PARENT_EMAIL = 'redesign.preview@example.com';
const PARENT_PASSWORD = 'Preview12345';

async function ensureParent() {
  try {
    return await call('/api/auth/login', { method: 'POST', body: { email: PARENT_EMAIL, password: PARENT_PASSWORD } });
  } catch {
    return await call('/api/auth/register', {
      method: 'POST',
      body: { email: PARENT_EMAIL, password: PARENT_PASSWORD, displayName: 'Redesign Preview' },
    });
  }
}

const parent = await ensureParent();
const pt = parent.token;
console.log('parent', parent.user.displayName, parent.familyId);

const { code } = await call('/api/families/pairing-code', {
  method: 'POST', token: pt,
  body: { childName: 'Leo', childAge: 9, tasks: TASKS },
});
console.log('pairing code', code);

const child = await call('/api/auth/register-child', {
  method: 'POST',
  body: { displayName: 'Leo', age: 9, pin: '2468', code },
}).catch((e) => { console.log('child register:', e.message.slice(0, 120)); return null; });

if (child?.token) console.log('child joined');

const family = await call('/api/family', { token: pt });
const kid = family.members.find((m) => m.role === 'child');
console.log('child member', kid && kid.displayName, kid && kid.id);

// Assign a few extra custom missions so the board has variety.
const extras = [
  { title: 'Set the table', missionTitle: 'Set the table', description: 'Plates, forks and glasses for everyone.', coins: 20, xp: 25, category: 'Bonus', icon: '🍽️', days: 'both', difficulty: 'easy', childId: kid.id },
  { title: 'Sort the recycling', missionTitle: 'Sort the recycling', description: 'Paper, plastic and glass in the right bins.', coins: 30, xp: 50, category: 'Bonus', icon: '♻️', days: 'Once', difficulty: 'hard', childId: kid.id },
];
for (const t of extras) {
  await call('/api/tasks', { method: 'POST', token: pt, body: t }).catch((e) => console.log('assign skip:', e.message.slice(0, 80)));
}

// Child submits two missions so the parent has a review queue.
if (child?.token) {
  const tasks = await call('/api/tasks', { token: child.token });
  const targets = tasks.tasks.slice(0, 2);
  for (const t of targets) {
    await call(`/api/tasks/${t.id}/submit`, { method: 'POST', token: child.token, body: { photoMode: 'optional' } })
      .catch((e) => console.log('submit skip:', e.message.slice(0, 90)));
  }
  console.log('submitted', targets.length, 'missions');
}

// A pending reward request so the rewards area has content.
await call('/api/rewards', { method: 'POST', token: pt, body: { name: 'Movie night pick', cost: 120, category: 'Treat', icon: '🎬' } }).catch((e) => console.log('reward skip:', e.message.slice(0, 80)));
const rewards = await call('/api/rewards', { token: pt });
const reward = rewards.rewards?.[0];
if (reward && child?.token) {
  await call(`/api/rewards/${reward.id}/request`, { method: 'POST', token: child.token, body: { note: 'Please can we watch the new film?' } })
    .catch((e) => console.log('reward request skip:', e.message.slice(0, 90)));
}

console.log('\nPARENT_TOKEN=' + pt);
console.log('CHILD_TOKEN=' + (child?.token || ''));
