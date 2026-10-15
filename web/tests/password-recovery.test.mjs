import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import { preparePasswordPayload } from '../lib/passwordServer.ts';

const proof = Buffer.alloc(32, 3).toString('base64');
const newProof = Buffer.alloc(32, 4).toString('base64');
function fixture() {
  const tables = { USERS: [], USER_ROLES: [], AUTH_CREDENTIALS: [], AUTH_SESSIONS: [], PASSWORD_RESET_REQUESTS: [], AUDIT_LOG: [], SCHOOLS: [{ SchoolID: 'school', SchoolName: 'School', Status: 'ACTIVE' }] };
  const properties = new Map();
  const clone = row => row ? structuredClone(row) : null;
  const context = vm.createContext({ console: { log() {} }, Date, JSON, Object, String, Number, Array, Boolean, Error,
    DETWIL: { PROPERTY_KEYS: {} }, DETWIL_bool: value => value === true || value === 'TRUE',
    DETWIL_uuid: randomUUID, DETWIL_nowIso: () => new Date().toISOString(),
    DETWIL_getActiveEmail: () => 'owner@example.org', DETWIL_isPasswordLoginEnabled: () => true,
    DETWIL_hashPassword_: (value, salt) => createHash('sha256').update(value + salt).digest('hex'),
    DETWIL_normalizeEmail: value => String(value || '').trim().toLowerCase(), DETWIL_validateEmail: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    DETWIL_jsonSuccess: data => ({ ok: true, data }), DETWIL_jsonError: (code, message) => ({ ok: false, error: { code, message } }),
    DETWIL_readAll: table => tables[table].map(clone),
    DETWIL_findFirstByField: (table, key, value) => clone(tables[table].find(row => row[key] === value && row.IsDeleted !== 'TRUE')),
    DETWIL_getScriptProperties_: () => ({ getProperty: key => properties.get(key), deleteProperty: key => properties.delete(key) }),
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_a, value) => createHash('sha256').update(value).digest(), base64Encode: value => Buffer.from(value).toString('base64') },
    MailApp: { sendEmail: () => assert.fail('Recovery must not send email') }, GmailApp: { sendEmail: () => assert.fail('Recovery must not send Gmail') },
  });
  for (const file of ['WorkService.gs', 'MembershipService.gs', 'RecoveryService.gs']) vm.runInContext(readFileSync(new URL('../../apps-script/' + file, import.meta.url), 'utf8'), context);
  context.DETWIL_workWrite_ = (table, row, key) => {
    const index = key ? tables[table].findIndex(item => item[key] === row[key]) : -1;
    if (index < 0) tables[table].push(clone(row)); else tables[table][index] = clone(row);
  };
  function account(id, role = 'TEACHER') {
    const user = { UserID: id, Email: id + '@example.org', DisplayName: id, PrimaryRole: role, SchoolID: role === 'TEACHER' ? 'school' : '', AccountStatus: 'ACTIVE', CanLogin: 'TRUE', PasswordLoginEnabled: 'TRUE', IsDeleted: 'FALSE' };
    tables.USERS.push(user);
    tables.AUTH_CREDENTIALS.push(context.DETWIL_memberCredential_(user, { value: proof, algorithm: 'SCRYPT_SHA256_V1' }, false, id));
    tables.USER_ROLES.push({ UserRoleID: randomUUID(), UserID: id, RoleCode: role, ScopeType: role === 'TEACHER' ? 'SCHOOL' : 'GLOBAL', ScopeID: role === 'TEACHER' ? 'school' : 'DETWIL', Status: 'ACTIVE', IsDeleted: 'FALSE' });
    return user;
  }
  const login = (user, passwordProof = proof) => context.DETWIL_workApi_('passwordLogin', { email: user.Email, passwordProof });
  const owner = account('owner', 'SUPER_ADMIN'); const teacher = account('teacher');
  const ownerToken = login(owner).data.token; const teacherToken = login(teacher).data.token;
  const api = (action, payload = {}, token = '') => context.DETWIL_recoveryApi_(action, payload, token);
  function issue(user = teacher) {
    assert.equal(api('recoveryRequest', { email: user.Email }).ok, true);
    const row = tables.PASSWORD_RESET_REQUESTS.find(row => row.UserID === user.UserID);
    const result = api('issuePasswordReset', { requestId: row.ResetRequestID, identityVerified: true }, ownerToken);
    assert.equal(result.ok, true, JSON.stringify(result));
    return { ...result.data, token: new URL(result.data.resetUrl).searchParams.get('token'), requestId: row.ResetRequestID };
  }
  return { context, tables, properties, account, owner, teacher, ownerToken, teacherToken, login, api, issue };
}

test('public recovery uses the same response for known, unknown and disabled emails, without changing login state', () => {
  const f = fixture(); const before = JSON.stringify([f.tables.USERS, f.tables.AUTH_CREDENTIALS, f.tables.AUTH_SESSIONS]);
  const known = f.api('recoveryRequest', { email: f.teacher.Email });
  assert.equal(JSON.stringify(known), JSON.stringify(f.api('recoveryRequest', { email: 'unknown@example.org' })));
  assert.equal(JSON.stringify(known), JSON.stringify(f.api('recoveryRequest', { email: f.teacher.Email, website: 'bot' })));
  assert.equal(JSON.stringify([f.tables.USERS, f.tables.AUTH_CREDENTIALS, f.tables.AUTH_SESSIONS]), before);
  assert.equal(f.tables.PASSWORD_RESET_REQUESTS.length, 1);
  assert.equal(f.tables.PASSWORD_RESET_REQUESTS[0].TokenHash, '');
  f.tables.USERS.find(row => row.UserID === f.teacher.UserID).AccountStatus = 'DISABLED';
  assert.equal(JSON.stringify(known), JSON.stringify(f.api('recoveryRequest', { email: f.teacher.Email })));
  assert.deepEqual(Object.keys(known.data), ['received']);
});

test('duplicate requests preserve pending and valid issued links; expired requests reuse the row', () => {
  const f = fixture(); const link = f.issue();
  const before = JSON.stringify(f.tables.PASSWORD_RESET_REQUESTS);
  for (let i = 0; i < 3; i++) f.api('recoveryRequest', { email: f.teacher.Email });
  assert.equal(JSON.stringify(f.tables.PASSWORD_RESET_REQUESTS), before);
  f.tables.PASSWORD_RESET_REQUESTS[0].ExpiresAt = '2000-01-01';
  f.api('recoveryRequest', { email: f.teacher.Email });
  assert.equal(f.tables.PASSWORD_RESET_REQUESTS.length, 1); assert.equal(f.tables.PASSWORD_RESET_REQUESTS[0].Status, 'PENDING');
  assert.equal(f.api('completePasswordReset', { token: link.token, email: f.teacher.Email, passwordProof: newProof }).ok, false);
});

test('only a selected active Super Admin can list requests or issue links after identity verification', () => {
  const f = fixture(); f.api('recoveryRequest', { email: f.teacher.Email });
  const payload = { requestId: f.tables.PASSWORD_RESET_REQUESTS[0].ResetRequestID, identityVerified: true };
  assert.equal(f.api('recoveryRequests').error.code, 'UNAUTHORIZED');
  assert.equal(f.api('recoveryRequests', {}, f.teacherToken).error.code, 'FORBIDDEN');
  assert.equal(f.api('issuePasswordReset', payload, f.teacherToken).error.code, 'FORBIDDEN');
  assert.equal(f.api('issuePasswordReset', { ...payload, identityVerified: false }, f.ownerToken).error.code, 'VALIDATION');
  f.tables.USER_ROLES.find(row => row.UserID === f.owner.UserID).Status = 'REVOKED';
  assert.equal(f.api('issuePasswordReset', payload, f.ownerToken).error.code, 'FORBIDDEN');
});

test('one-time link tokens are hashed in Sheets and absent from audit and sanitized admin lists', () => {
  const f = fixture(); const link = f.issue(); const row = f.tables.PASSWORD_RESET_REQUESTS[0];
  assert.equal(new URL(link.resetUrl).origin, 'https://detwil-kru.vercel.app');
  assert.equal(row.TokenHash, f.context.DETWIL_workHash_(link.token));
  assert.notEqual(row.TokenHash, link.token);
  assert.equal(JSON.stringify(f.tables).includes(link.token), false);
  const list = f.api('recoveryRequests', {}, f.ownerToken);
  assert.equal(list.ok, true); assert.equal(list.data.items.length, 1);
  assert.doesNotMatch(JSON.stringify(list), /TokenHash|CredentialVersionHash|PasswordHash|resetUrl/);
});

test('completion revokes every session, replaces the hash, leaves roles unchanged and never automatically logs in', () => {
  const f = fixture(); const link = f.issue(); f.login(f.teacher);
  const roles = JSON.stringify(f.tables.USER_ROLES); const users = JSON.stringify(f.tables.USERS);
  const result = f.api('completePasswordReset', { token: link.token, email: ' TEACHER@EXAMPLE.ORG ', passwordProof: newProof, password: 'must-not-be-stored' });
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.data.changed, true);
  assert.equal(JSON.stringify(f.tables.USER_ROLES), roles); assert.equal(JSON.stringify(f.tables.USERS), users);
  assert.equal(JSON.stringify(f.tables).includes('must-not-be-stored'), false);
  assert.equal(f.context.DETWIL_workApi_('session', {}, f.teacherToken).error.code, 'UNAUTHORIZED');
  assert.equal(f.tables.AUTH_SESSIONS.filter(row => row.UserID === f.teacher.UserID && row.IsDeleted !== 'TRUE').length, 0);
  assert.equal(f.login(f.teacher).ok, false); assert.equal(f.login(f.teacher, newProof).ok, true);
  assert.equal(f.tables.PASSWORD_RESET_REQUESTS[0].Status, 'USED'); assert.equal(f.tables.PASSWORD_RESET_REQUESTS[0].TokenHash, '');
  assert.equal(f.api('completePasswordReset', { token: link.token, email: f.teacher.Email, passwordProof: newProof }).error.code, 'INVALID_STATE');
});

test('expired, malformed and wrong-email links cannot change credentials or revoke sessions', () => {
  for (const scenario of ['expired', 'invalid-date', 'wrong-email', 'malformed', 'bad-proof']) {
    const f = fixture(); const link = f.issue(); const payload = { token: link.token, email: f.teacher.Email, passwordProof: newProof };
    if (scenario === 'expired') f.tables.PASSWORD_RESET_REQUESTS[0].ExpiresAt = '2000-01-01';
    if (scenario === 'invalid-date') f.tables.PASSWORD_RESET_REQUESTS[0].ExpiresAt = 'bad';
    if (scenario === 'wrong-email') payload.email = f.owner.Email;
    if (scenario === 'malformed') payload.token = 'bad';
    if (scenario === 'bad-proof') payload.passwordProof = 'raw-password';
    const before = JSON.stringify(f.tables);
    assert.equal(f.api('completePasswordReset', payload).ok, false, scenario);
    assert.equal(JSON.stringify(f.tables), before, scenario);
  }
});

test('a link cannot reactivate suspended, deleted, expired or password-disabled accounts', () => {
  for (const patch of [{ AccountStatus: 'DISABLED' }, { IsDeleted: 'TRUE' }, { CanLogin: 'FALSE' }, { PasswordLoginEnabled: 'FALSE' }, { EndDate: '2000-01-01' }, { StartDate: 'invalid' }]) {
    const f = fixture(); const link = f.issue(); Object.assign(f.tables.USERS.find(row => row.UserID === f.teacher.UserID), patch);
    const before = JSON.stringify(f.tables);
    assert.equal(f.api('completePasswordReset', { token: link.token, email: f.teacher.Email, passwordProof: newProof }).ok, false);
    assert.equal(JSON.stringify(f.tables), before);
  }
});

test('reissuing invalidates the older link, and any later credential change invalidates the issued link', () => {
  const f = fixture(); const first = f.issue(); const second = f.issue(); assert.notEqual(first.token, second.token);
  assert.equal(f.api('completePasswordReset', { token: first.token, email: f.teacher.Email, passwordProof: newProof }).ok, false);
  f.tables.AUTH_CREDENTIALS.find(row => row.UserID === f.teacher.UserID).PasswordSalt = 'changed-with-same-timestamp';
  assert.equal(f.api('completePasswordReset', { token: second.token, email: f.teacher.Email, passwordProof: newProof }).ok, false);
  f.api('recoveryRequest', { email: f.teacher.Email }); assert.equal(f.tables.PASSWORD_RESET_REQUESTS[0].Status, 'PENDING');
});

test('partial Sheets failure after the credential update cannot allow token replay', () => {
  const f = fixture(); const link = f.issue(); const write = f.context.DETWIL_workWrite_;
  f.context.DETWIL_workWrite_ = (table, row, key) => { if (table === 'PASSWORD_RESET_REQUESTS') throw new Error('Sheet unavailable'); write(table, row, key); };
  const payload = { token: link.token, email: f.teacher.Email, passwordProof: newProof };
  assert.equal(f.api('completePasswordReset', payload).error.code, 'UNAVAILABLE');
  f.context.DETWIL_workWrite_ = write;
  assert.equal(f.api('completePasswordReset', payload).error.code, 'INVALID_STATE');
  assert.equal(f.login(f.teacher, newProof).ok, true);
});

test('Super Admin recovery requires its own authenticated Google owner and an explicit editor target', () => {
  const f = fixture(); f.api('recoveryRequest', { email: f.owner.Email });
  const row = f.tables.PASSWORD_RESET_REQUESTS[0];
  assert.equal(f.api('issuePasswordReset', { requestId: row.ResetRequestID, identityVerified: true }, f.ownerToken).error.code, 'FORBIDDEN');
  assert.throws(() => f.context.DETWIL_issueEditorPasswordReset(), { code: 'VALIDATION' });
  f.properties.set('DETWIL_RECOVERY_TARGET_EMAIL', f.owner.Email);
  const result = f.context.DETWIL_issueEditorPasswordReset(); assert.ok(result.resetUrl);
  assert.equal(f.properties.has('DETWIL_RECOVERY_TARGET_EMAIL'), false);
  const other = f.account('another-owner', 'SUPER_ADMIN'); f.properties.set('DETWIL_RECOVERY_TARGET_EMAIL', other.Email);
  assert.throws(() => f.context.DETWIL_issueEditorPasswordReset(), { code: 'FORBIDDEN' });
  f.context.DETWIL_getActiveEmail = () => 'stranger@example.org';
  assert.throws(() => f.context.DETWIL_issueEditorPasswordReset(), { code: 'FORBIDDEN' });
});

test('the reset password is transformed on the web server and never forwarded as plaintext', async () => {
  const value = await preparePasswordPayload('completePasswordReset', { token: 'fixture-token', email: 'Teacher@Example.ORG', password: 'fixture-password-only' });
  assert.equal(value.email, 'teacher@example.org'); assert.equal('password' in value, false);
  assert.match(value.passwordProof, /^[A-Za-z0-9+/]{43}=$/); assert.equal(value.token, 'fixture-token');
});

test('HTTP routes cannot call editor-only recovery bootstrap or fallback', () => {
  const f = fixture(); const c = f.context;
  c.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) };
  c.DETWIL_handleError = error => { throw error; };
  c.DETWIL_preparePasswordRecovery = () => assert.fail('Editor bootstrap must not run through HTTP');
  c.DETWIL_issueEditorPasswordReset = () => assert.fail('Editor reset must not run through HTTP');
  vm.runInContext(readFileSync(new URL('../../apps-script/Code.gs', import.meta.url), 'utf8'), c);
  for (const action of ['DETWIL_preparePasswordRecovery', 'DETWIL_issueEditorPasswordReset']) {
    const result = c.doPost({ postData: { contents: JSON.stringify({ action }) } });
    assert.equal(JSON.parse(result.text).error.code, 'UNKNOWN_ACTION');
  }
});

test('a password change rechecks session revocation after acquiring the write lock', () => {
  const f = fixture();
  f.context.LockService = { getScriptLock: () => ({ waitLock() {
    f.tables.AUTH_SESSIONS.filter(row => row.UserID === f.teacher.UserID).forEach(row => { row.IsDeleted = 'TRUE'; });
  }, releaseLock() {} }) };
  const before = JSON.stringify(f.tables.AUTH_CREDENTIALS);
  const result = f.context.DETWIL_workApi_('changePassword', { email: f.teacher.Email, currentProof: proof, passwordProof: newProof }, f.teacherToken);
  assert.equal(result.error.code, 'UNAUTHORIZED');
  assert.equal(JSON.stringify(f.tables.AUTH_CREDENTIALS), before);
});
