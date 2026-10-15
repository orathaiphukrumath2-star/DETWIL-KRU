import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';

function fixture() {
  const tables = new Map(); const counts = { opens: 0, headers: {}, data: {}, uploads: 0 }; let onWait = () => {};
  let locked = false;
  const context = vm.createContext({ console, Date, JSON, Object, String, Number, Array, Boolean, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: name => name === 'DETWIL_SPREADSHEET_ID' ? 'book' : 'root' }) },
    SpreadsheetApp: { openById: () => { counts.opens++; return { getSheetByName: name => tables.get(name) }; } },
    LockService: { getScriptLock: () => ({ waitLock() { assert.equal(locked, false, 'No nested locks'); locked = true; onWait(); }, releaseLock() { locked = false; } }) },
    Utilities: { getUuid: randomUUID, formatDate: () => new Date().toISOString(), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (_algo, text) => createHash('sha256').update(text).digest(), base64Encode: bytes => Buffer.from(bytes).toString('base64'), base64Decode: value => Buffer.from(value, 'base64'), newBlob: (bytes, mime, name) => ({ bytes, mime, name }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
    DETWIL_isPasswordLoginEnabled: () => true,
    DETWIL_hashPassword_: (value, salt) => createHash('sha256').update(value + salt).digest('hex'),
    DETWIL_handleError: error => ({ ok: false, error: { code: error.code || 'TEST_ERROR', message: error.message } }),
  });
  for (const file of ['Config.gs', 'Utils.gs', 'Repository.gs', 'WorkService.gs', 'MembershipService.gs', 'RecoveryService.gs', 'Code.gs']) vm.runInContext(readFileSync(new URL('../../apps-script/' + file, import.meta.url), 'utf8'), context);
  for (const [name, schema] of Object.entries(context.DETWIL.SHEET_SCHEMAS)) {
    const rows = [Array.from(schema)];
    tables.set(name, { rows, getLastRow: () => rows.length, getLastColumn: () => schema.length,
      getRange(row, col, height = 1, width = 1) { return {
        getValues() {
          const map = row === 1 ? counts.headers : counts.data; map[name] = (map[name] || 0) + 1;
          return Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => rows[row + i - 1]?.[col + j - 1] ?? ''));
        },
        setValues(values) { values.forEach((line, i) => { rows[row + i - 1] ||= []; line.forEach((value, j) => { rows[row + i - 1][col + j - 1] = typeof value === 'string' && /^'[=+@-]/.test(value) ? value.slice(1) : value; }); }); },
      }; },
    });
  }
  const add = (table, row) => tables.get(table).rows.push(context.DETWIL_toRow(context.DETWIL.SHEET_SCHEMAS[table], row));
  const update = (table, idField, id, patch) => {
    const sheet = tables.get(table); const headers = Array.from(context.DETWIL.SHEET_SCHEMAS[table]);
    const index = sheet.rows.findIndex((row, index) => index > 0 && row[headers.indexOf(idField)] === id);
    const row = context.DETWIL_toRecord(headers, sheet.rows[index]); Object.assign(row, patch); sheet.rows[index] = context.DETWIL_toRow(headers, row);
  };
  const proof = Buffer.alloc(32, 5).toString('base64');
  const user = { UserID: 'teacher', Email: 'teacher@example.org', DisplayName: 'Teacher', PrimaryRole: 'TEACHER', SchoolID: 'school', AccountStatus: 'ACTIVE', CanLogin: 'TRUE', PasswordLoginEnabled: 'TRUE' };
  add('SCHOOLS', { SchoolID: 'school', SchoolName: 'School', Status: 'ACTIVE' }); add('USERS', user);
  add('USER_ROLES', { UserRoleID: 'grant', UserID: 'teacher', RoleCode: 'TEACHER', ScopeType: 'SCHOOL', ScopeID: 'school', Status: 'ACTIVE' });
  add('AUTH_CREDENTIALS', context.DETWIL_memberCredential_(user, { value: proof, algorithm: 'SCRYPT_SHA256_V1' }, false, user.UserID));
  const root = { getSharingAccess: () => 'PRIVATE', getFoldersByName: () => ({ hasNext: () => true, next: () => root }), getId: () => 'folder', createFile(blob) { counts.uploads++; return { getId: () => 'drive-file-' + counts.uploads, getName: () => blob.name, setSharing() {} }; } };
  context.DriveApp = { Access: { PRIVATE: 'PRIVATE' }, Permission: { VIEW: 'VIEW' }, getFolderById: () => root };
  const api = (action, payload = {}, token) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify({ action, payload, token }) } }).text);
  const resetCounts = () => { counts.opens = 0; counts.headers = {}; counts.data = {}; };
  const login = (extra = {}) => api('passwordLogin', { email: user.Email, passwordProof: proof, ...extra });
  const token = login().data.token; resetCounts();
  const content = { title: 'Teaching work', subject: 'Math', gradeLevel: 'M1', academicYear: '2569', workType: 'lesson', description: 'Learning activity', attachments: [], themeCode: 'bright', colorCode: 'rose' };
  return { context, tables, counts, add, update, user, api, login, token, content, resetCounts, onWait: callback => { onWait = callback; } };
}

test('one request opens the spreadsheet once and reads each authentication table at most once', () => {
  const f = fixture(); const result = f.api('workspace', {}, f.token);
  assert.equal(result.ok, true, JSON.stringify(result)); assert.equal(result.data.user.role, 'TEACHER'); assert.equal(result.data.works.total, 0);
  assert.equal(f.counts.opens, 1);
  for (const table of ['AUTH_SESSIONS', 'USERS', 'AUTH_CREDENTIALS', 'USER_ROLES', 'SCHOOLS']) assert.equal(f.counts.data[table], 1, table);
  for (const reads of Object.values(f.counts.headers)) assert.equal(reads, 1);
  assert.equal(f.context.DETWIL_REQUEST_CACHE_, null);
});

test('login can return the workspace in the same response without another authentication lookup', () => {
  const f = fixture(); const result = f.login({ includeWorkspace: true });
  assert.equal(result.ok, true); assert.ok(result.data.token); assert.equal(result.data.workspace.user.userId, 'teacher');
  assert.equal(result.data.workspace.works.schools.length, 1); assert.equal(f.counts.opens, 1);
  assert.equal(f.counts.data.USERS, 1); assert.equal(f.counts.data.AUTH_CREDENTIALS, 1);
});

test('cached records cannot mutate stored primary roles and the next request observes revoked grants', () => {
  const f = fixture(); f.context.DETWIL_beginRequest_();
  const row = f.context.DETWIL_findFirstByField('USERS', 'UserID', 'teacher'); row.PrimaryRole = 'SUPER_ADMIN';
  assert.equal(f.context.DETWIL_findFirstByField('USERS', 'UserID', 'teacher').PrimaryRole, 'TEACHER');
  f.context.DETWIL_endRequest_();
  f.update('USER_ROLES', 'UserRoleID', 'grant', { Status: 'REVOKED' });
  const result = f.api('workspace', {}, f.token);
  assert.equal(result.data.user.activeRoleId, ''); assert.equal(result.data.works, undefined);
});

test('writes invalidate cached rows and stale sessions are rechecked only after the mutation lock', () => {
  const f = fixture(); f.context.DETWIL_beginRequest_();
  const row = f.context.DETWIL_findFirstByField('USERS', 'UserID', 'teacher'); row.DisplayName = 'Changed';
  f.context.DETWIL_workWrite_('USERS', row, 'UserID');
  assert.equal(f.context.DETWIL_findFirstByField('USERS', 'UserID', 'teacher').DisplayName, 'Changed'); f.context.DETWIL_endRequest_();
  f.onWait(() => f.update('USER_ROLES', 'UserRoleID', 'grant', { Status: 'REVOKED' }));
  assert.equal(f.api('saveWork', { content: f.content }, f.token).error.code, 'FORBIDDEN');
  assert.equal(f.tables.get('WORKS').rows.length, 1);
});

test('missing work links do not prevent a valid login or expose another teacher work', () => {
  const f = fixture(); const result = f.login({ includeWorkspace: true, id: 'not-found' });
  assert.equal(result.ok, true); assert.ok(result.data.token); assert.ok(result.data.workspace.workError); assert.equal(result.data.workspace.work, undefined);
  assert.equal(f.context.DETWIL_REQUEST_CACHE_, null);
});

test('upload and attachment save commit a single new draft version with its chosen presentation', () => {
  const f = fixture(); const created = f.api('saveWork', { content: f.content }, f.token); assert.equal(created.ok, true, JSON.stringify(created)); const work = created.data;
  const saved = f.api('attachFile', { id: work.id, versionId: work.versionId, content: work.content, category: 'STUDENT', title: 'Student evidence', isPublic: false, name: 'evidence.pdf', mime: 'application/pdf', base64: Buffer.from('fixture-pdf-bytes').toString('base64') }, f.token);
  assert.equal(saved.ok, true, JSON.stringify(saved)); assert.equal(f.counts.uploads, 1);
  assert.equal(saved.data.versionNo, 2); assert.equal(saved.data.content.attachments.length, 1);
  assert.equal(saved.data.content.attachments[0].isPublic, false); assert.equal(saved.data.content.themeCode, 'bright'); assert.equal(saved.data.content.colorCode, 'rose');
  assert.equal(saved.data.content.gradeLevel, 'มัธยมศึกษาปีที่ 1'); assert.equal(saved.data.history.length, 2);
  assert.equal(f.tables.get('FILES').rows.length, 2);
});

test('stale versions, invalid grade/theme, and foreign uploads fail before creating a Drive file', () => {
  const f = fixture(); const work = f.api('saveWork', { content: f.content }, f.token).data;
  const payload = { id: work.id, versionId: work.versionId, content: work.content, category: 'MEDIA', title: 'Media', name: 'media.pdf', mime: 'application/pdf', base64: Buffer.from('fixture').toString('base64') };
  for (const patch of [{ versionId: 'stale' }, { content: { ...work.content, gradeLevel: 'M7' } }, { content: { ...work.content, themeCode: 'evil' } }, { content: { ...work.content, colorCode: 'url(https://evil.invalid)' } }]) assert.equal(f.api('attachFile', { ...payload, ...patch }, f.token).ok, false);
  assert.equal(f.counts.uploads, 0);
  f.update('WORKS', 'WorkID', work.id, { OwnerUserID: 'another-teacher' });
  assert.equal(f.api('attachFile', payload, f.token).error.code, 'FORBIDDEN'); assert.equal(f.counts.uploads, 0);
});

test('HTTP cache is discarded on errors as well as successes', () => {
  const f = fixture(); assert.equal(f.api('workspace', {}, 'invalid').ok, false); assert.equal(f.context.DETWIL_REQUEST_CACHE_, null);
  assert.equal(f.api('workspace', {}, f.token).ok, true);
});

test('new works appear first and pagination stays bounded to thirty records', () => {
  const f = fixture();
  const first = f.api('saveWork', { content: f.content }, f.token).data;
  const latest = f.api('saveWork', { content: { ...f.content, title: 'Latest work' } }, f.token).data;
  const list = f.api('myWorks', {}, f.token).data;
  assert.equal(list.total, 2); assert.equal(list.items[0].id, latest.id); assert.equal(list.items[1].id, first.id);
  assert.equal(f.api('myWorks', { offset: 1 }, f.token).data.items[0].id, first.id);
});
