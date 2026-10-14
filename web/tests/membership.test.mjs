import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import { allowAuthAttempt, passwordProof, preparePasswordPayload } from '../lib/passwordServer.ts';

const proof = Buffer.alloc(32, 1).toString('base64');
const replacementProof = Buffer.alloc(32, 2).toString('base64');
function fixture() {
  const tables = { USERS: [], USER_ROLES: [], AUTH_CREDENTIALS: [], AUTH_SESSIONS: [], AUDIT_LOG: [], WORKS: [], WORKFLOW_LOG: [], SCHOOLS: [{ SchoolID: 's1', SchoolName: 'School One', Status: 'ACTIVE' }, { SchoolID: 's2', SchoolName: 'School Two', Status: 'ACTIVE' }] };
  const clone = row => row ? JSON.parse(JSON.stringify(row)) : null;
  const context = vm.createContext({ console, Date, JSON, Object, String, Number, Array, Boolean, Error,
    DETWIL: { SHEET_SCHEMAS: { AUTH_SESSIONS: ['SessionID','TokenHash','UserID','ExpiresAt','CreatedAt','IsDeleted','ActiveRoleID'] }, PROPERTY_KEYS: {} },
    DETWIL_bool: x => x === true || String(x).toUpperCase() === 'TRUE', DETWIL_uuid: randomUUID, DETWIL_nowIso: () => new Date().toISOString(),
    DETWIL_getActiveEmail: () => 'admin@example.org', DETWIL_isPasswordLoginEnabled: () => true,
    DETWIL_hashPassword_: (p, salt) => createHash('sha256').update(String(p) + salt).digest('hex'),
    DETWIL_normalizeEmail: x => String(x || '').trim().toLowerCase(), DETWIL_validateEmail: x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x),
    DETWIL_jsonSuccess: data => ({ ok: true, data }), DETWIL_jsonError: (code, message) => ({ ok: false, error: { code, message } }),
    DETWIL_readAll: table => (tables[table] || []).map(clone),
    DETWIL_findFirstByField: (table, field, value) => clone((tables[table] || []).find(row => row[field] === value && row.IsDeleted !== 'TRUE')),
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_a, value) => createHash('sha256').update(value).digest(), base64Encode: value => Buffer.from(value).toString('base64') },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: () => assert.fail('No registration email quota should be consumed') }, GmailApp: { sendEmail: () => assert.fail('No Gmail calls should be made') },
  });
  for (const file of ['WorkService.gs','MembershipService.gs']) vm.runInContext(readFileSync(new URL('../../apps-script/' + file, import.meta.url), 'utf8'), context);
  context.DETWIL_workWrite_ = (table, row, id) => { const index = id ? tables[table].findIndex(r => r[id] === row[id]) : -1; if (index < 0) tables[table].push(clone(row)); else tables[table][index] = clone(row); };
  context.DETWIL_updateRecordById = (table, field, id, patch) => { const row = context.DETWIL_findFirstByField(table, field, id); Object.assign(row, patch); context.DETWIL_workWrite_(table, row, field); return row; };
  function grant(user, role, school = '', status = 'ACTIVE') { const row = { UserRoleID: randomUUID(), UserID: user.UserID, RoleCode: role, ScopeType: school ? 'SCHOOL' : 'GLOBAL', ScopeID: school || 'DETWIL', Status: status, IsDeleted: 'FALSE' }; tables.USER_ROLES.push(row); return row; }
  function account(id, role, school = '') { const user = { UserID: id, Email: id + '@example.org', DisplayName: id, PrimaryRole: role, SchoolID: school, AccountStatus: 'ACTIVE', CanLogin: 'TRUE', PasswordLoginEnabled: 'TRUE', IsDeleted: 'FALSE' }; tables.USERS.push(user); tables.AUTH_CREDENTIALS.push(context.DETWIL_memberCredential_(user, { value: proof, algorithm: 'SCRYPT_SHA256_V1' }, false, id)); grant(user, role, school); return user; }
  const admin = account('admin', 'SUPER_ADMIN');
  function login(user, remember = false) { return context.DETWIL_workApi_('passwordLogin', { email: user.Email, passwordProof: proof, remember }); }
  const adminToken = login(admin).data.token;
  function register(roles = [{ role: 'TEACHER', schoolId: 's1' }], overrides = {}) { return context.DETWIL_memberApi_('register', { email: 'new@example.org', displayName: 'New Teacher', passwordProof: proof, roles, ...overrides }); }
  return { context, tables, grant, account, admin, adminToken, login, register };
}

test('self registration stores only a salted hash and pending roles, never auto-grants admin access', () => {
  const f = fixture(); assert.equal(f.register([{ role:'TEACHER',schoolId:'s1' },{ role:'SCHOOL_ADMIN',schoolId:'s1' }], { PrimaryRole:'SUPER_ADMIN', status:'ACTIVE', password:'not-stored' }).ok, true);
  const user = f.tables.USERS.find(u => u.Email === 'new@example.org'); assert.equal(user.PrimaryRole, 'PUBLIC_VISITOR'); assert.equal(user.AccountStatus, 'PENDING');
  const roles = f.tables.USER_ROLES.filter(r => r.UserID === user.UserID); assert.equal(roles.length, 2); assert.ok(roles.every(r => r.Status === 'PENDING'));
  const credential = f.tables.AUTH_CREDENTIALS.find(c => c.UserID === user.UserID); assert.equal(credential.PasswordAlgorithm, 'SCRYPT_SHA256_V1'); assert.notEqual(credential.PasswordHash, proof); assert.ok(credential.PasswordSalt);
  assert.equal(JSON.stringify(f.tables).includes('not-stored'), false);
  const token = f.login(user).data.token; assert.equal(f.context.DETWIL_workApi_('session', {}, token).ok, true); assert.equal(f.context.DETWIL_workApi_('myWorks', {}, token).error.code, 'FORBIDDEN');
});

test('duplicate emails and self-requested SUPER_ADMIN are rejected without creating extra users', () => {
  const f = fixture(); assert.equal(f.register([{role:'SUPER_ADMIN'}]).ok, false); assert.equal(f.tables.USERS.length, 1);
  assert.equal(f.register().ok, true); assert.equal(f.register([], { email:' NEW@EXAMPLE.ORG ' }).error.code, 'ACCOUNT_EXISTS'); assert.equal(f.tables.USERS.length, 2);
});

test('members can register before the school list is populated without inventing school records', () => {
  const f = fixture(); f.tables.SCHOOLS.length = 0; assert.equal(f.register([]).ok, true); assert.equal(f.tables.SCHOOLS.length, 0);
  assert.equal(f.tables.USERS[1].AccountStatus, 'PENDING');
});

test('one account switches among approved school-scoped roles without combining their privileges', () => {
  const f = fixture(); const user = f.account('teacher', 'TEACHER', 's1'); const other = f.grant(user, 'SCHOOL_ADMIN', 's2');
  const token = f.login(user).data.token;
  f.tables.WORKS.push({ WorkID:'w2', OwnerUserID:'someone-else', SchoolID:'s2', ContentJson:'{"title":"Private"}', CurrentVersionID:'v1', ApprovalStatus:'SCHOOL_PENDING' });
  assert.equal(f.context.DETWIL_workApi_('getWork', {id:'w2'}, token).error.code, 'FORBIDDEN');
  const switched = f.context.DETWIL_memberApi_('switchRole',{roleId:other.UserRoleID},token); assert.equal(switched.data.role,'SCHOOL_ADMIN'); assert.equal(switched.data.schoolId,'s2');
  assert.equal(f.context.DETWIL_workApi_('getWork',{id:'w2'},token).ok,true);
  assert.equal(f.context.DETWIL_workApi_('adminData',{},token).error.code,'FORBIDDEN');
  const foreign = f.tables.USER_ROLES.find(r=>r.UserID===f.admin.UserID); assert.equal(f.context.DETWIL_memberApi_('switchRole',{roleId:foreign.UserRoleID},token).error.code,'FORBIDDEN');
});

test('school and district roles stay pending until a super admin approves each grant', () => {
  const f = fixture(); f.register([{role:'TEACHER',schoolId:'s1'},{role:'SUPERVISOR',schoolId:'s2'}]); const user=f.tables.USERS[1]; const token=f.login(user).data.token;
  const grants=f.tables.USER_ROLES.filter(r=>r.UserID===user.UserID);
  assert.equal(f.context.DETWIL_memberApi_('roleDecision',{roleId:grants[0].UserRoleID,decision:'APPROVE'},token).error.code,'FORBIDDEN');
  assert.equal(f.context.DETWIL_memberApi_('roleDecision',{roleId:grants[0].UserRoleID,decision:'APPROVE'},f.adminToken).ok,true);
  assert.equal(f.tables.USERS[1].AccountStatus,'ACTIVE'); assert.equal(f.tables.USER_ROLES.find(r=>r.UserRoleID===grants[1].UserRoleID).Status,'PENDING');
  assert.equal(grants[1].ScopeType,'GLOBAL'); assert.equal(grants[1].ScopeID,'DETWIL');
  assert.equal(f.context.DETWIL_memberApi_('switchRole',{roleId:grants[1].UserRoleID},token).ok,false);
  assert.ok(f.tables.AUDIT_LOG.some(r=>r.Action==='ROLE_APPROVE'));
});

test('revocation and expiration take effect on existing sessions; PrimaryRole cannot resurrect removed privileges', () => {
  const f=fixture(); const user=f.account('reviewer','SCHOOL_ADMIN','s1'); const role=f.tables.USER_ROLES.find(r=>r.UserID===user.UserID); const token=f.login(user).data.token;
  assert.equal(f.context.DETWIL_memberApi_('roleDecision',{roleId:role.UserRoleID,decision:'REVOKE'},f.adminToken).ok,true);
  assert.equal(f.context.DETWIL_workApi_('session',{},token).data.role,'PUBLIC_VISITOR'); assert.equal(f.context.DETWIL_workApi_('myWorks',{},token).ok,false);
  f.tables.USER_ROLES.find(r=>r.UserRoleID===role.UserRoleID).Status='ACTIVE'; f.tables.USER_ROLES.find(r=>r.UserRoleID===role.UserRoleID).EndDate='2000-01-01';
  assert.equal(f.context.DETWIL_workApi_('session',{},token).data.activeRoleId,'');
  f.tables.USER_ROLES.find(r=>r.UserRoleID===role.UserRoleID).EndDate='invalid'; assert.equal(f.context.DETWIL_workApi_('session',{},token).data.activeRoleId,'');
});

test('remembered login has a fixed 30-day expiry; normal login stays eight hours and logout revokes it', () => {
  const f=fixture(); const user=f.account('teacher','TEACHER','s1'); const normal=f.login(user); const remembered=f.login(user,true);
  assert.equal(normal.data.maxAge,28800); assert.equal(remembered.data.maxAge,2592000);
  const row=f.tables.AUTH_SESSIONS.find(s=>s.TokenHash===f.context.DETWIL_workHash_(remembered.data.token)); assert.ok(new Date(row.ExpiresAt).getTime()>Date.now()+29*86400000);
  assert.equal(f.context.DETWIL_workApi_('logout',{},remembered.data.token).ok,true); assert.equal(f.context.DETWIL_workApi_('session',{},remembered.data.token).error.code,'UNAUTHORIZED');
});

test('members can request additional roles only for their own account and repeat requests do not duplicate grants', () => {
  const f=fixture(); const user=f.account('teacher','TEACHER','s1'); const token=f.login(user).data.token;
  const payload={ userId:f.admin.UserID,roles:[{role:'SCHOOL_ADMIN',schoolId:'s2',Status:'ACTIVE'}] };
  assert.equal(f.context.DETWIL_memberApi_('requestRoles',payload,token).ok,true); assert.equal(f.context.DETWIL_memberApi_('requestRoles',payload,token).ok,true);
  const roles=f.tables.USER_ROLES.filter(r=>r.RoleCode==='SCHOOL_ADMIN'); assert.equal(roles.length,1); assert.equal(roles[0].UserID,user.UserID); assert.equal(roles[0].Status,'PENDING');
});

test('admin temporary-password reset revokes sessions and requires the member to choose a new password', () => {
  const f=fixture(); const user=f.account('teacher','TEACHER','s1'); const token=f.login(user).data.token;
  assert.equal(f.context.DETWIL_memberApi_('resetMemberPassword',{userId:user.UserID,email:user.Email,passwordProof:replacementProof},f.adminToken).ok,true);
  assert.equal(f.context.DETWIL_workApi_('session',{},token).error.code,'UNAUTHORIZED');
  const login=f.context.DETWIL_workApi_('passwordLogin',{email:user.Email,passwordProof:replacementProof}); assert.equal(login.ok,true); assert.equal(login.data.user.mustChangePassword,true);
  assert.equal(f.context.DETWIL_workApi_('myWorks',{},login.data.token).error.code,'PASSWORD_CHANGE_REQUIRED');
  assert.equal(f.context.DETWIL_workApi_('changePassword',{email:user.Email,currentProof:replacementProof,passwordProof:proof},login.data.token).ok,true);
  assert.equal(f.context.DETWIL_workApi_('session',{},login.data.token).error.code,'UNAUTHORIZED'); assert.equal(f.login(user).data.user.mustChangePassword,false);
  assert.equal(f.context.DETWIL_memberApi_('resetMemberPassword',{userId:f.admin.UserID,email:f.admin.Email,passwordProof:proof},f.adminToken).ok,false);
});

test('registration rejects forged scopes, disabled schools and invalid password material', () => {
  const f=fixture(); assert.equal(f.register([{role:'SCHOOL_ADMIN',schoolId:'not-real'}]).ok,false);
  f.tables.SCHOOLS[0].Status='DISABLED'; assert.equal(f.register().ok,false);
  assert.equal(f.register([], {passwordProof:'raw-password'}).ok,false); assert.equal(f.tables.USERS.length,1);
});

test('session schema upgrade appends only the new header and refuses mismatched existing data', () => {
  const f=fixture(); let headers=['SessionID','TokenHash','UserID','ExpiresAt','CreatedAt','IsDeleted'];
  f.context.DETWIL_getHeaders=()=>[...headers]; f.context.DETWIL_getSheet=()=>({getMaxColumns:()=>26,getRange:(_r,c)=>({setValue:v=>{headers[c-1]=v;return {setFontWeight(){}};}})});
  assert.equal(f.context.DETWIL_prepareMembershipSystem().ok,true); assert.equal(headers[6],'ActiveRoleID'); assert.equal(headers[0],'SessionID');
  headers=['WrongHeader']; assert.throws(()=>f.context.DETWIL_prepareMembershipSystem(),/ไม่ตรงกัน/); assert.deepEqual(headers,['WrongHeader']);
});

test('server-side scrypt proof is email-bound; new passwords are removed before forwarding', async () => {
  const a=await preparePasswordPayload('register',{email:' Teacher@Example.ORG ',password:'fixture-password-only',roles:[]});
  assert.equal(a.email,'teacher@example.org'); assert.equal('password' in a,false); assert.match(a.passwordProof,/^[A-Za-z0-9+/]{43}=$/);
  assert.equal(a.passwordProof,await passwordProof('teacher@example.org','fixture-password-only'));
  assert.notEqual(a.passwordProof,await passwordProof('other@example.org','fixture-password-only'));
  await assert.rejects(()=>preparePasswordPayload('register',{email:'teacher@example.org',password:'short'}));
});

test('auth throttling is bounded and resets after its window without calling Google', () => {
  const key=randomUUID(); for(let i=0;i<20;i++)assert.equal(allowAuthAttempt(key,1000),true); assert.equal(allowAuthAttempt(key,1000),false); assert.equal(allowAuthAttempt(key,601001),true);
});

test('successful legacy login upgrades password storage without changing the member password', () => {
  const f=fixture(); const user=f.account('legacy','TEACHER','s1'); const cred=f.tables.AUTH_CREDENTIALS.find(c=>c.UserID===user.UserID);
  cred.PasswordAlgorithm='SHA256_ITERATED_V1'; cred.PasswordHash=f.context.DETWIL_hashPassword_('fixture-legacy-password',cred.PasswordSalt);
  const result=f.context.DETWIL_workApi_('passwordLogin',{email:user.Email,password:'fixture-legacy-password',passwordProof:proof}); assert.equal(result.ok,true);
  assert.equal(f.tables.AUTH_CREDENTIALS.find(c=>c.UserID===user.UserID).PasswordAlgorithm,'SCRYPT_SHA256_V1'); assert.equal(f.login(user).ok,true);
  assert.equal(f.context.DETWIL_workApi_('passwordLogin',{email:user.Email,password:'fixture-legacy-password'}).ok,false);
});
