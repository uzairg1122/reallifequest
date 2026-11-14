// End-to-end check of the spec section 10 work: consent, public league opt-in,
// nickname filtering, flagged-XP exclusion, report/block, reactions and export.
const BASE = process.env.RLQ_API || 'http://127.0.0.1:8081/api';
const stamp = Date.now();

async function call(path, { method = 'GET', token = '', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  return { status: res.status, payload };
}

async function ensureParent(email, password, displayName) {
  const login = await call('/auth/login', { method: 'POST', body: { email, password } });
  if (login.status === 200) return login.payload.token;
  const reg = await call('/auth/register', { method: 'POST', body: { email, password, displayName } });
  if (reg.status !== 201) throw new Error(`parent setup failed: ${JSON.stringify(reg.payload)}`);
  return reg.payload.token;
}

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`); }
};

const PASSWORD = 'Safety12345';
const parentA = await ensureParent(`safety-a-${stamp}@example.com`, PASSWORD, 'Safety Parent A');
const parentB = await ensureParent(`safety-b-${stamp}@example.com`, PASSWORD, 'Safety Parent B');

// Two children in family A: one Little band (8) and one Junior band (11).
const children = [];
for (const [name, age] of [['Little One', 8], ['Junior One', 11]]) {
  const code = await call('/families/pairing-code', {
    method: 'POST', token: parentA,
    body: { childName: name, childAge: age, tasks: Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, missionTitle: `T${i}`, description: 'd', coins: 10, xp: 10, category: 'Bonus', icon: '⭐', days: 'both' })) },
  });
  const joined = await call('/auth/register-child', { method: 'POST', body: { displayName: name, age, code: code.payload.code, pin: '1234' } });
  children.push({ name, age, id: joined.payload.user.id, token: joined.payload.token });
}
const familyA = await call('/family', { token: parentA });

console.log('\n1. Public league is opt-in, not automatic');
const leagueBefore = await call('/league', { token: parentA });
const groupsBefore = leagueBefore.payload.leagues || [];
check('both children start off the public league', groupsBefore.every(g => g.optedOut === true), JSON.stringify(groupsBefore.map(g => g.optedOut)));
check('opt-out reason is consent_required', groupsBefore.every(g => g.optedOutReason === 'consent_required'));
check('no cross-family entries are returned', groupsBefore.every(g => g.entries.length === 0));

console.log('\n2. Opt-in is refused before consent');
const earlyOptIn = await call('/league/opt-in', { method: 'POST', token: parentA, body: { childId: children[0].id, enabled: true } });
check('opt-in without consent returns 422', earlyOptIn.status === 422, JSON.stringify(earlyOptIn.payload));

console.log('\n3. Consent is recorded with an audit trail');
const consent = await call('/safety/consent', { method: 'POST', token: parentA, body: { childId: children[0].id, granted: true } });
check('consent grant returns the child state', consent.status === 200 && consent.payload.child.consented === true);
const consentView = await call('/safety/consent', { token: parentA });
check('audit history has one entry', consentView.payload.history.length === 1, JSON.stringify(consentView.payload.history));
check('audit records the scope', consentView.payload.history[0]?.scope === 'app_data_collection');

console.log('\n4. Consent enables the public league opt-in');
const optIn = await call('/league/opt-in', { method: 'POST', token: parentA, body: { childId: children[0].id, enabled: true } });
check('opt-in now succeeds', optIn.status === 200 && optIn.payload.leagueOptIn === true, JSON.stringify(optIn.payload));
check('Little band is still Little band', optIn.payload.ageBand === 'little');
const leagueAfter = await call('/league', { token: parentA });
const little = leagueAfter.payload.leagues.find(g => g.childId === children[0].id);
check('opted-in child now has a board', little && little.optedOut === false && little.entries.length > 0, JSON.stringify(little));
check('other child stays off the board', leagueAfter.payload.leagues.find(g => g.childId === children[1].id)?.optedOut === true);

console.log('\n5. Public boards show nicknames, not real names');
const nickname = await call('/safety/nickname', { method: 'POST', token: parentA, body: { childId: children[0].id, nickname: 'Brave Fox' } });
check('safe nickname accepted', nickname.status === 200);
const boardAfterNickname = await call('/league', { token: parentA });
const boardNames = boardAfterNickname.payload.leagues.find(g => g.childId === children[0].id).entries.map(e => e.display_name);
check('no real name on the board', !boardNames.includes('Little One'), JSON.stringify(boardNames));
check('nickname appears on the board', boardNames.includes('Brave Fox'), JSON.stringify(boardNames));

console.log('\n6. Nickname filter blocks profanity and personal info');
for (const bad of ['f u c k', 'call me 5551234567', 'visit www.bad.com', '123 Main Street', '']) {
  const r = await call('/safety/nickname', { method: 'POST', token: parentA, body: { childId: children[0].id, nickname: bad } });
  check(`rejects ${JSON.stringify(bad)}`, r.status === 422, JSON.stringify(r.payload));
}
const nicknameUnchanged = await call('/safety/consent', { token: parentA });
check('a rejected nickname does not overwrite the good one', nicknameUnchanged.payload.children.find(c => c.childId === children[0].id).publicNickname === 'Brave Fox');

console.log('\n7. Another family cannot see or touch this child');
const foreignConsent = await call('/safety/consent', { method: 'POST', token: parentB, body: { childId: children[0].id, granted: true } });
check('foreign consent update is 404', foreignConsent.status === 404, JSON.stringify(foreignConsent.payload));
const foreignNickname = await call('/safety/nickname', { method: 'POST', token: parentB, body: { childId: children[0].id, nickname: 'Hacker' } });
check('foreign nickname update is 404', foreignNickname.status === 404);
const foreignExport = await call('/safety/export', { token: parentB });
check('foreign export contains no family A data', !JSON.stringify(foreignExport.payload).includes('Brave Fox'));

console.log('\n8. Flagged XP is excluded from every ranking');
// Approve enough Hard missions to blow through the 300 XP daily cap, so recordXpApproval
// has to flag the overflow. That is exactly the XP the boards must not count.
for (let i = 0; i < 7; i++) {
  const assigned = await call('/tasks', { method: 'POST', token: parentA, body: { childId: children[1].id, title: `Hard ${i}`, missionTitle: `Hard ${i}`, description: 'x', coins: 5, difficulty: 'hard', category: 'Bonus', icon: '⭐', days: 'both' } });
  const submitted = await call(`/tasks/${assigned.payload.id}/submit`, { method: 'POST', token: children[1].token, body: {} });
  await call(`/submissions/${submitted.payload.submissionId}/approve`, { method: 'POST', token: parentA, body: {} });
}
const board = await call('/leaderboard', { token: parentA });
const weeklyRow = board.payload.weekly.find(r => r.id === children[1].id);
const ledger = await call('/safety/export', { token: parentA });
const rows = (ledger.payload.xpLedger || []).filter(e => e.child_id === children[1].id);
const flaggedRows = rows.filter(e => e.flagged);
const unflaggedThisWeek = rows.filter(e => !e.flagged && e.iso_week === board.payload.week).reduce((s, e) => s + Number(e.xp), 0);
const rawThisWeek = rows.filter(e => e.iso_week === board.payload.week).reduce((s, e) => s + Number(e.xp), 0);
check('the daily cap actually flagged a row', flaggedRows.length > 0, `flagged=${flaggedRows.length}`);
check('the board counts only unflagged XP', Number(weeklyRow.xp) === unflaggedThisWeek, `board=${weeklyRow.xp} unflagged=${unflaggedThisWeek}`);
check('the board is capped at 300 for the day', Number(weeklyRow.xp) === 300, `board=${weeklyRow.xp}`);
check('unflagged total is below the raw ledger total', unflaggedThisWeek <= rawThisWeek, `unflagged=${unflaggedThisWeek} raw=${rawThisWeek}`);

console.log('\n9. Reactions are preset-only');
const reactBad = await call('/safety/reaction', { method: 'POST', token: children[0].token, body: { userId: children[1].id, emoji: '💩' } });
check('non-preset emoji rejected', reactBad.status === 422, JSON.stringify(reactBad.payload));
const reactOk = await call('/safety/reaction', { method: 'POST', token: children[0].token, body: { userId: children[1].id, emoji: '👏' } });
check('preset emoji accepted', reactOk.status === 200 && reactOk.payload.counts['👏'] === 1, JSON.stringify(reactOk.payload));
const reactSelf = await call('/safety/reaction', { method: 'POST', token: children[0].token, body: { userId: children[0].id, emoji: '🔥' } });
check('cannot react to yourself', reactSelf.status === 422);

console.log('\n10. Report blocks immediately');
const report = await call('/safety/report', { method: 'POST', token: children[0].token, body: { userId: children[1].id, reason: 'name', details: 'rude name' } });
check('report accepted', report.status === 201 && report.payload.blocked === true, JSON.stringify(report.payload));
const blocks = await call('/safety/blocks', { token: children[0].token });
check('block is recorded', blocks.payload.blocks.includes(children[1].id));
const filed = await call('/safety/reports', { token: parentA });
check('parent can see the filed report', filed.payload.reports.length === 1 && filed.payload.reports[0].status === 'open', JSON.stringify(filed.payload));
const badReason = await call('/safety/report', { method: 'POST', token: children[0].token, body: { userId: children[1].id, reason: 'weapon' } });
check('unknown reason falls into the "other" bucket', badReason.status === 201);
const filedAfter = await call('/safety/reports', { token: parentA });
check('reason is normalised to a known bucket', filedAfter.payload.reports.every(r => ['name', 'avatar', 'behaviour', 'spam', 'other'].includes(r.reason)));

console.log('\n10b. A blocked child disappears from the blocker\'s public board');
// Two children of the same age band, both consented and opted in, so their boards overlap.
const bandPair = [];
for (const name of ['Board Kid A', 'Board Kid B']) {
  const code = await call('/families/pairing-code', {
    method: 'POST', token: parentA,
    body: { childName: name, childAge: 12, tasks: Array.from({ length: 5 }, (_, i) => ({ title: `T${i}`, missionTitle: `T${i}`, description: 'd', coins: 10, xp: 10, category: 'Bonus', icon: '⭐', days: 'both' })) },
  });
  const joined = await call('/auth/register-child', { method: 'POST', body: { displayName: name, age: 12, code: code.payload.code, pin: '1234' } });
  await call('/safety/consent', { method: 'POST', token: parentA, body: { childId: joined.payload.user.id, granted: true } });
  await call('/league/opt-in', { method: 'POST', token: parentA, body: { childId: joined.payload.user.id, enabled: true } });
  bandPair.push({ name, id: joined.payload.user.id, token: joined.payload.token });
}
const beforeBlock = await call('/league', { token: bandPair[0].token });
const boardIds = beforeBlock.payload.leagues.find(g => g.childId === bandPair[0].id)?.entries.map(e => e.id) || [];
check('both children share a board before blocking', boardIds.includes(bandPair[1].id), JSON.stringify(boardIds));
await call('/safety/block', { method: 'POST', token: bandPair[0].token, body: { userId: bandPair[1].id, blocked: true } });
const afterBlock = await call('/league', { token: bandPair[0].token });
const blockerBoard = afterBlock.payload.leagues.find(g => g.childId === bandPair[0].id)?.entries.map(e => e.id) || [];
check('blocked child is gone from the blocker\'s board', !blockerBoard.includes(bandPair[1].id), JSON.stringify(blockerBoard));
check('blocker still sees themselves', blockerBoard.includes(bandPair[0].id));
const blockedView = await call('/league', { token: bandPair[1].token });
const blockedBoard = blockedView.payload.leagues.find(g => g.childId === bandPair[1].id)?.entries.map(e => e.id) || [];
check('blocking is one-directional', blockedBoard.includes(bandPair[0].id), JSON.stringify(blockedBoard));

console.log('\n11. Withdrawing consent removes the child from public boards immediately');
const revoke = await call('/safety/consent', { method: 'POST', token: parentA, body: { childId: children[0].id, granted: false } });
check('revoke accepted', revoke.status === 200 && revoke.payload.child.consented === false);
check('revoke also clears the league opt-in', revoke.payload.child.leagueOptIn === false);
const afterRevoke = await call('/league', { token: parentA });
const revoked = afterRevoke.payload.leagues.find(g => g.childId === children[0].id);
check('child is off the board after revoking', revoked.optedOut === true && revoked.entries.length === 0);
const auditNow = await call('/safety/consent', { token: parentA });
const childHistory = auditNow.payload.history.filter(h => h.childId === children[0].id);
check('audit keeps both the grant and the revoke', childHistory.some(h => h.granted) && childHistory.some(h => !h.granted), JSON.stringify(childHistory.map(h => h.granted)));

console.log('\n12. Data export and deletion');
const exportRes = await call('/safety/export', { token: parentA });
check('export returns the family', exportRes.status === 200 && exportRes.payload.family.id === familyA.payload.family.id);
for (const section of ['children', 'tasks', 'xpLedger', 'wallets', 'consents']) {
  check(`export includes ${section}`, Array.isArray(exportRes.payload[section]));
}
const wrongPassword = await call('/safety/erase-child', { method: 'POST', token: parentA, body: { childId: children[0].id, password: 'nope', confirm: `erase ${children[0].name}` } });
check('erase needs the right password', wrongPassword.status === 422);
const wrongConfirm = await call('/safety/erase-child', { method: 'POST', token: parentA, body: { childId: children[0].id, password: PASSWORD, confirm: 'yes' } });
check('erase needs the typed confirmation', wrongConfirm.status === 422);
const erased = await call('/safety/erase-child', { method: 'POST', token: parentA, body: { childId: children[0].id, password: PASSWORD, confirm: `erase ${children[0].name}` } });
check('erase succeeds', erased.status === 200 && erased.payload.ok === true, JSON.stringify(erased.payload));
const gone = await call('/auth/child-login', { method: 'POST', body: { displayName: children[0].name, pin: '1234', parentEmail: `safety-a-${stamp}@example.com` } });
check('erased child can no longer sign in', gone.status === 401, JSON.stringify(gone.payload));
const afterErase = await call('/safety/export', { token: parentA });
check('erased child is gone from the export', !afterErase.payload.children.some(c => c.id === children[0].id));
const childDelete = await call('/family/delete-child', { method: 'POST', token: parentA, body: { childId: children[1].id, password: PASSWORD } });
check('existing simple delete still works', childDelete.status === 200, JSON.stringify(childDelete.payload));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
