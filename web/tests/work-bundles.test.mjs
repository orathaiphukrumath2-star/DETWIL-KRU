import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import { safeExternalUrl } from '../lib/works.ts';
import { sheetSchemas } from '../lib/schema.ts';
import { isSameOrigin } from '../lib/requestSecurity.ts';

function fixture() {
  const tables = { WORKS: [], USER_ROLES: [{ UserRoleID: 'teacher-grant', UserID: 't1', RoleCode: 'TEACHER', ScopeType: 'SCHOOL', ScopeID: 's1', Status: 'ACTIVE' }], AUDIT_LOG: [], AUTH_SESSIONS: [], FILES: [], REVIEWS: [], RECORD_VERSIONS: [], WORKFLOW_LOG: [], USERS: [], AUTH_CREDENTIALS: [], SCHOOLS: [{ SchoolID: 's1', SchoolName: 'School One', Status: 'ACTIVE' }, { SchoolID: 's2', SchoolName: 'School Two', Status: 'ACTIVE' }] };
  const properties = {};
  const context = vm.createContext({ console, Date, JSON, Object, String, Number, Array, Error, Boolean,
    DETWIL: { SHEET_SCHEMAS: {}, PROPERTY_KEYS: {} },
    DETWIL_bool: x => x === true || String(x).toUpperCase() === 'TRUE',
    DETWIL_uuid: randomUUID, DETWIL_nowIso: () => new Date().toISOString(),
    DETWIL_getActiveEmail: () => '',
    DETWIL_isPasswordLoginEnabled: () => true,
    DETWIL_hashPassword_: (password, salt) => createHash('sha256').update(String(password) + salt).digest('hex'),
    DETWIL_normalizeEmail: x => String(x).trim().toLowerCase(),
    DETWIL_jsonSuccess: data => ({ ok: true, data }),
    DETWIL_jsonError: (code, message) => ({ ok: false, error: { code, message } }),
    DETWIL_readAll: table => tables[table],
    DETWIL_findFirstByField: (table, field, value) => { const row = tables[table]?.find(r => r[field] === value && r.IsDeleted !== 'TRUE'); return row ? JSON.parse(JSON.stringify(row)) : null; },
    DETWIL_getScriptProperties_: () => ({ getProperty: k => properties[k], setProperty: (k, v) => properties[k] = v, deleteProperty: k => delete properties[k] }),
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_a, value) => createHash('sha256').update(value).digest(), base64Encode: value => Buffer.from(value).toString('base64') },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  });
  vm.runInContext(readFileSync(new URL('../../apps-script/WorkService.gs', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../../apps-script/MembershipService.gs', import.meta.url), 'utf8'), context);
  context.DETWIL_workWrite_ = (table, row, id) => { const index = id ? tables[table].findIndex(r => r[id] === row[id]) : -1; const clone = JSON.parse(JSON.stringify(row)); if (index >= 0) tables[table][index] = clone; else tables[table].push(clone); };
  const teacher = { UserID: 't1', DisplayName: 'Teacher One', SchoolID: 's1', PrimaryRole: 'TEACHER' };
  const reviewer = { UserID: 'r1', SchoolID: 's1', PrimaryRole: 'SCHOOL_ADMIN' };
  const district = { UserID: 'd1', PrimaryRole: 'SUPERVISOR' };
  const content = { title: 'Teaching bundle', subject: 'Math', gradeLevel: 'M1', academicYear: '2569', workType: 'lesson', description: 'Learning activity', objectives: '', results: '', schoolId: 's1', attachments: [{ id: 'plan', category: 'PLAN', title: 'Lesson plan', url: 'https://example.org/plan.pdf', isPublic: true }, { id: 'media', category: 'MEDIA', title: 'Teaching media', url: 'https://example.org/media', isPublic: true }, { id: 'student', category: 'STUDENT', title: 'Private student evidence', url: 'https://example.org/private', isPublic: false }] };
  const save = (changes = {}, existing = null) => context.DETWIL_saveWork_({ id: existing?.id, versionId: existing?.versionId, content: { ...content, ...changes } }, teacher);
  const flow = (work, command, user = teacher, comment = '') => context.DETWIL_workflow_({ id: work.id, versionId: work.versionId, command, comment }, user);
  const approve = work => flow(flow(flow(flow(work, 'SUBMIT_SCHOOL'), 'APPROVE', reviewer), 'SUBMIT_DISTRICT'), 'APPROVE', district);
  return { context, tables, teacher, reviewer, district, content, save, flow, approve };
}

test('draft is durable but not publicly readable; publication excludes private evidence', () => {
  const f = fixture(); const work = f.save();
  assert.equal(f.tables.RECORD_VERSIONS.length, 1);
  assert.throws(() => f.context.DETWIL_publicProjection_(f.tables.WORKS[0]), /ไม่พบผลงาน/);
  assert.throws(() => f.flow(work, 'PUBLISH'), /โรงเรียนและเขต/);
  f.flow(f.approve(work), 'PUBLISH');
  const result = f.context.DETWIL_publicProjection_(f.tables.WORKS[0]);
  assert.equal(result.content.attachments.length, 2);
  assert.equal(JSON.stringify(result).includes('Private student evidence'), false);
  assert.equal(JSON.stringify(f.tables.WORKS[0].PublishedJson).includes('/private'), false);
  assert.equal(result.approvalStatus, 'DISTRICT_APPROVED');
});

test('theme and color belong to the reviewed version; edits cannot change the published theme without review', () => {
  const f = fixture(); const draft = f.save({ themeCode: 'bright', colorCode: 'rose', gradeLevel: 'ม.6' });
  f.flow(f.approve(draft), 'PUBLISH');
  const published = f.context.DETWIL_publicProjection_(f.tables.WORKS[0]);
  assert.equal(published.content.themeCode, 'bright'); assert.equal(published.content.colorCode, 'rose');
  assert.equal(published.content.gradeLevel, 'มัธยมศึกษาปีที่ 6');
  const changed = f.save({ themeCode: 'editorial', colorCode: 'blue' }, draft);
  assert.equal(changed.approvalStatus, 'DRAFT');
  assert.equal(f.context.DETWIL_publicProjection_(f.tables.WORKS[0]).content.themeCode, 'bright');
  assert.throws(() => f.flow(changed, 'PUBLISH'), /โรงเรียนและเขต/);
});

test('school then district approval is enforced, cannot self-review or cross schools', () => {
  const f = fixture(); let w = f.save();
  assert.throws(() => f.flow(w, 'SUBMIT_DISTRICT'), /ไม่สามารถเปลี่ยน/);
  w = f.flow(w, 'SUBMIT_SCHOOL');
  assert.throws(() => f.flow(w, 'APPROVE', { ...f.reviewer, SchoolID: 's2' }), /ไม่มีสิทธิ์/);
  assert.throws(() => f.flow(w, 'APPROVE', { ...f.teacher, PrimaryRole: 'SCHOOL_ADMIN' }), /ไม่มีสิทธิ์/);
  assert.throws(() => f.flow(w, 'APPROVE', f.district), /ไม่มีสิทธิ์/);
  w = f.flow(w, 'APPROVE', f.reviewer);
  assert.equal(w.approvalStatus, 'SCHOOL_APPROVED');
  w = f.flow(w, 'SUBMIT_DISTRICT'); w = f.flow(w, 'APPROVE', f.district);
  assert.equal(w.approvalStatus, 'DISTRICT_APPROVED');
  assert.equal(f.tables.REVIEWS.length, 2);
});

test('editing an approved work resets review, preserves published approved snapshot until republish', () => {
  const f = fixture(); let w = f.flow(f.approve(f.save()), 'PUBLISH');
  const oldVersion = w.versionId;
  w = f.save({ title: 'Revised title' }, w);
  assert.equal(w.approvalStatus, 'DRAFT');
  let published = f.context.DETWIL_publicProjection_(f.tables.WORKS[0]);
  assert.equal(published.versionId, oldVersion); assert.equal(published.content.title, 'Teaching bundle'); assert.equal(published.approvalStatus, 'DISTRICT_APPROVED');
  assert.throws(() => f.flow(w, 'PUBLISH'), /โรงเรียนและเขต/);
  w = f.flow(f.approve(w), 'PUBLISH'); published = f.context.DETWIL_publicProjection_(f.tables.WORKS[0]);
  assert.equal(published.content.title, 'Revised title'); assert.equal(published.approvalStatus, 'DISTRICT_APPROVED');
});

test('pending works cannot change, stale versions conflict and returns need feedback', () => {
  const f = fixture(); let w = f.save();
  assert.throws(() => f.save({}, { ...w, versionId: 'stale' }), /หน้าต่างอื่น/);
  w = f.flow(w, 'SUBMIT_SCHOOL');
  assert.throws(() => f.save({}, w), /ถอนคำขอ/);
  assert.throws(() => f.flow(w, 'RETURN', f.reviewer), /กรอกข้อมูล/);
  w = f.flow(w, 'RETURN', f.reviewer, 'Please add results'); assert.equal(w.approvalStatus, 'RETURNED');
  assert.equal(f.tables.REVIEWS[0].Comment, 'Please add results');
});

test('file references and school ownership cannot be forged', () => {
  const f = fixture(); let w = f.save({ schoolId: 's2' }); assert.equal(w.content.schoolId, 's1');
  f.tables.FILES.push({ FileRecordID: 'foreign', ParentID: 'different', UploadedBy: 't1' });
  assert.throws(() => f.save({ attachments: [{ category: 'PLAN', title: 'Foreign', fileId: 'foreign' }] }, w), /ไฟล์แนบไม่ใช่/);
  assert.throws(() => f.context.DETWIL_saveWork_({ id: w.id, versionId: w.versionId, content: f.content }, { ...f.teacher, UserID: 't2' }), /เจ้าของ/);
});

test('publication requires shareable plans and media; unpublish removes access', () => {
  const f = fixture(); let w = f.save({ attachments: [] });
  assert.throws(() => f.flow(w, 'PUBLISH'), /แผนการสอนและสื่อ/);
  w = f.save({}, w); w = f.flow(f.approve(w), 'PUBLISH'); f.flow(w, 'UNPUBLISH');
  assert.throws(() => f.context.DETWIL_publicProjection_(f.tables.WORKS[0]), /ไม่พบผลงาน/);
});

test('HTTPS URL allow-list rejects scripts, credentials, invalid URLs', () => {
  for (const url of ['javascript:alert(1)', 'http://example.org', 'https://name:secret@example.org', 'bad url']) assert.equal(safeExternalUrl(url), '');
  assert.equal(safeExternalUrl('https://example.org/document'), 'https://example.org/document');
  const f = fixture(); assert.throws(() => f.save({ attachments: [{ category: 'PLAN', title: 'Attack', url: 'javascript:alert(1)' }] }), /https/);
});

test('opaque sessions are hashed, expire, and are checked against current account status', () => {
  const f = fixture(); const token = 'secret-token'; const u = { ...f.teacher, AccountStatus: 'ACTIVE', CanLogin: 'TRUE', PasswordLoginEnabled: 'TRUE' };
  f.tables.USERS.push(u); f.tables.AUTH_CREDENTIALS.push({ UserID: u.UserID, CredentialStatus: 'ACTIVE', MustChangePassword: 'FALSE' });
  const session = { TokenHash: f.context.DETWIL_workHash_(token), UserID: u.UserID, ExpiresAt: new Date(Date.now() + 60000).toISOString() }; f.tables.AUTH_SESSIONS.push(session);
  assert.notEqual(session.TokenHash, token); assert.equal(f.context.DETWIL_sessionUser_(token, false).UserID, u.UserID);
  u.AccountStatus = 'DISABLED'; assert.throws(() => f.context.DETWIL_sessionUser_(token, false), /ไม่สามารถเข้า/); u.AccountStatus = 'ACTIVE';
  session.ExpiresAt = '2000-01-01'; assert.throws(() => f.context.DETWIL_sessionUser_(token, false), /หมดเวลา/);
});

test('public file download cannot expose private evidence or foreign file IDs', () => {
  const f = fixture(); let w = f.save(); f.flow(f.approve(w), 'PUBLISH');
  assert.throws(() => f.context.DETWIL_downloadFile_({ id: w.id, fileId: 'foreign' }, ''), /ไม่พบไฟล์/);
  assert.throws(() => f.context.DETWIL_downloadFile_({ id: w.id, fileId: 'foreign', preview: true }, ''), /เข้าสู่ระบบ/);
});

test('publication is blocked at draft, school-pending, school-approved and district-pending stages', () => {
  const f=fixture(); let w=f.save();
  assert.throws(()=>f.flow(w,'PUBLISH'),/โรงเรียนและเขต/);
  w=f.flow(w,'SUBMIT_SCHOOL'); assert.throws(()=>f.flow(w,'PUBLISH'),/โรงเรียนและเขต/);
  w=f.flow(w,'APPROVE',f.reviewer); assert.throws(()=>f.flow(w,'PUBLISH'),/โรงเรียนและเขต/);
  w=f.flow(w,'SUBMIT_DISTRICT'); assert.throws(()=>f.flow(w,'PUBLISH'),/โรงเรียนและเขต/);
  w=f.flow(w,'APPROVE',f.district); assert.equal(f.flow(w,'PUBLISH').isPublic,true);
});

test('legacy unreviewed public snapshots are hidden from listing, direct page and file routes', () => {
  const f=fixture(); const w=f.save(); const row=f.tables.WORKS[0];
  row.IsPublic='TRUE'; row.PublishedVersionID=w.versionId; row.PublishedJson=row.ContentJson;
  assert.equal(f.context.DETWIL_workApi_('publicWorks',{}).data.total,0);
  assert.equal(f.context.DETWIL_workApi_('publicWork',{id:w.id}).error.code,'NOT_FOUND');
  assert.equal(f.context.DETWIL_workApi_('downloadFile',{id:w.id,fileId:'anything'}).error.code,'NOT_FOUND');
  const report=f.context.DETWIL_migrateOpenMembership_({UserID:'owner',PrimaryRole:'SUPER_ADMIN'});
  assert.equal(report.unapprovedWorksUnpublished,1); assert.equal(f.tables.WORKS[0].IsPublic,'FALSE');
  assert.equal(f.tables.WORKS[0].ContentJson,row.ContentJson);
});

test('approval must belong to the same work and version and include both school and district', () => {
  const f=fixture(); const w=f.save(); const row=f.tables.WORKS[0]; row.ApprovalStatus='DISTRICT_APPROVED';
  assert.throws(()=>f.flow(w,'PUBLISH'),/โรงเรียนและเขต/);
  f.tables.WORKFLOW_LOG.push({RecordType:'WORK',RecordID:w.id,VersionID:w.versionId,Action:'APPROVE',FromApprovalStatus:'DISTRICT_PENDING',ToApprovalStatus:'DISTRICT_APPROVED'});
  assert.throws(()=>f.flow(w,'PUBLISH'),/โรงเรียนและเขต/);
  f.tables.WORKFLOW_LOG.push({RecordType:'WORK',RecordID:'other-work',VersionID:w.versionId,Action:'APPROVE',FromApprovalStatus:'SCHOOL_PENDING',ToApprovalStatus:'SCHOOL_APPROVED'});
  assert.throws(()=>f.flow(w,'PUBLISH'),/โรงเรียนและเขต/);
});

test('anonymous API mutations, forged role payloads and owner bootstrap are rejected', () => {
  const f = fixture();
  const result = f.context.DETWIL_workApi_('saveWork', { content: f.content, role: 'SUPER_ADMIN' }, '');
  assert.equal(result.ok, false); assert.equal(result.error.code, 'UNAUTHORIZED');
  assert.throws(() => f.context.DETWIL_setupOwner_(''), /ผู้ดูแล/);
  assert.throws(() => f.context.DETWIL_setupOwner_('forged'), /ลิงก์เปิดใช้งาน/);
});

test('login locks after five failures, issues only a hashed session and forces temporary password changes', () => {
  const f = fixture(); const password = 'fixture-only-password';
  const u = { ...f.teacher, Email: 'teacher@example.org', AccountStatus: 'ACTIVE', CanLogin: 'TRUE', PasswordLoginEnabled: 'TRUE' }; f.tables.USERS.push(u);
  const cred = { CredentialID: 'c1', UserID: u.UserID, CredentialStatus: 'ACTIVE', PasswordSalt: 'salt', PasswordAlgorithm: 'SHA256_ITERATED_V1', PasswordHash: f.context.DETWIL_hashPassword_(password, 'salt'), MustChangePassword: 'TRUE' }; f.tables.AUTH_CREDENTIALS.push(cred);
  for (let i = 0; i < 5; i++) assert.equal(f.context.DETWIL_workApi_('passwordLogin', { email: u.Email, password: 'wrong' }).error.code, 'INVALID_CREDENTIALS');
  assert.ok(new Date(f.tables.AUTH_CREDENTIALS[0].LockedUntil).getTime() > Date.now());
  assert.equal(f.context.DETWIL_workApi_('passwordLogin', { email: u.Email, password }).ok, false);
  f.tables.AUTH_CREDENTIALS[0].LockedUntil = '';
  const result = f.context.DETWIL_workApi_('passwordLogin', { email: u.Email, password });
  assert.equal(result.ok, true); assert.equal(result.data.user.mustChangePassword, true);
  assert.notEqual(f.tables.AUTH_SESSIONS[0].TokenHash, result.data.token);
  assert.equal(f.context.DETWIL_workApi_('myWorks', {}, result.data.token).error.code, 'PASSWORD_CHANGE_REQUIRED');
});

test('frontend and Apps Script schemas stay identical, including migration tables', () => {
  const context = vm.createContext({}); vm.runInContext(readFileSync(new URL('../../apps-script/Config.gs', import.meta.url), 'utf8'), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.DETWIL.SHEET_SCHEMAS)), JSON.parse(JSON.stringify(sheetSchemas)));
});

test('CSRF origin check uses public host, rejects foreign origins, downgrade, missing and malformed origins', () => {
  assert.equal(isSameOrigin('http://localhost:3111', 'localhost:3111', 'http'), true);
  assert.equal(isSameOrigin('https://detwil-kru.vercel.app', 'detwil-kru.vercel.app', 'https'), true);
  for (const origin of [null, 'null', 'https://untrusted.example', 'http://detwil-kru.vercel.app', 'https://detwil-kru.vercel.app/']) assert.equal(isSameOrigin(origin, 'detwil-kru.vercel.app', 'https'), false);
});
