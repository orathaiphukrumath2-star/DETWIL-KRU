import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

function fixture() {
  const sheets = new Map();
  let title = 'DETWIL Database - [โปรดเติมข้อมูลจริง: ชื่อหน่วยงาน]';
  const makeSheet = (name, rows = []) => {
    const sheet = {
      rows, getLastRow: () => rows.length, getLastColumn: () => Math.max(0, ...rows.map(row => row.length)),
      getMaxColumns: () => 50, insertColumnsAfter() {}, setFrozenRows() {}, getSheetId: () => 123,
      getRange(row, column, height = 1, width = 1) {
        return {
          getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => rows[row - 1 + i]?.[column - 1 + j] ?? '')),
          setValues(values) { values.forEach((valuesRow, i) => { rows[row - 1 + i] ||= []; valuesRow.forEach((value, j) => { rows[row - 1 + i][column - 1 + j] = value; }); }); },
          setValue(value) { rows[row - 1] ||= []; rows[row - 1][column - 1] = value; return this; }, setFontWeight() { return this; },
        };
      },
    };
    sheets.set(name, sheet); return sheet;
  };
  const book = { getSheetByName: name => sheets.get(name), getName: () => title, rename: value => { title = value; }, getUrl: () => 'https://docs.google.com/spreadsheets/d/test/edit' };
  const context = vm.createContext({ console: { log() {} }, Date, JSON, Object, String, Boolean,
    DETWIL_uuid: randomUUID, DETWIL_nowIso: () => new Date().toISOString(), DETWIL_bool: value => value === true || value === 'TRUE',
    DETWIL_owner_: () => ({ UserID: 'owner' }), DETWIL_getSpreadsheet: () => book,
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    DETWIL_memberAudit_() {}, DETWIL_findFirstByField: () => null,
    DETWIL_workError_: (code, message) => { throw Object.assign(new Error(message), { code }); },
  });
  vm.runInContext(readFileSync(new URL('../../apps-script/Config.gs', import.meta.url), 'utf8'), context);
  vm.runInContext(readFileSync(new URL('../../apps-script/SchoolRegistration.gs', import.meta.url), 'utf8'), context);
  const schema = context.DETWIL.SHEET_SCHEMAS;
  Object.entries(schema).forEach(([name, headers]) => makeSheet(name, [Array.from(headers)]));
  context.DETWIL_ensureSheet = name => { const sheet = sheets.get(name) || makeSheet(name); sheet.rows[0] = Array.from(schema[name]); return sheet; };
  context.DETWIL_getHeaders = name => sheets.get(name).rows[0];
  context.DETWIL_toRow = (headers, row) => headers.map(key => row[key] ?? '');
  context.DETWIL_readAll = name => sheets.get(name).rows.slice(1).map(row => Object.fromEntries(sheets.get(name).rows[0].map((key, i) => [key, row[i] ?? ''])));
  context.DETWIL_registrationOptions_ = () => ({ schools: context.DETWIL_readAll('SCHOOLS').filter(row => row.Status === 'ACTIVE' && !context.DETWIL_bool(row.IsDeleted)) });
  return { context, sheets, book, schema, makeSheet };
}

test('editor setup repairs missing tables and seeds 31 schools once without granting roles', () => {
  const f = fixture(); f.sheets.delete('SCHOOLS'); f.sheets.delete('WORKS');
  const users = structuredClone(f.sheets.get('USERS').rows);
  const roles = structuredClone(f.sheets.get('USER_ROLES').rows);
  const report = f.context.DETWIL_prepareSchoolRegistration();
  assert.equal(report.tableCount, 29); assert.equal(report.addedSchools, 31); assert.equal(report.activeSchools, 31);
  assert.deepEqual(Array.from(report.createdTables).sort(), ['SCHOOLS', 'WORKS']);
  assert.match(report.spreadsheetUrl, /#gid=123$/); assert.equal(report.ownerPasswordReady, false);
  const before = structuredClone(f.sheets.get('SCHOOLS').rows);
  assert.equal(f.context.DETWIL_prepareSchoolRegistration().addedSchools, 0);
  assert.deepEqual(f.sheets.get('SCHOOLS').rows, before);
  assert.deepEqual(f.sheets.get('USERS').rows, users); assert.deepEqual(f.sheets.get('USER_ROLES').rows, roles);
  assert.equal(new Set(f.context.DETWIL_readAll('SCHOOLS').map(row => row.SchoolCode)).size, 31);
});

test('school seeding preserves existing IDs, edited codes, inactive and deleted records', () => {
  const f = fixture();
  const existing = [
    { SchoolID: 'keep-id', SchoolCode: 'custom-code', SchoolName: 'โรงเรียน ปทุมเทพวิทยาคาร', Status: 'INACTIVE' },
    { SchoolID: 'deleted-id', SchoolCode: '43012002', SchoolName: 'Edited school name', Status: 'ACTIVE', IsDeleted: 'TRUE' },
  ];
  existing.forEach(row => f.sheets.get('SCHOOLS').rows.push(f.context.DETWIL_toRow(f.schema.SCHOOLS, row)));
  const before = structuredClone(f.sheets.get('SCHOOLS').rows.slice(1));
  const report = f.context.DETWIL_prepareSchoolRegistration();
  assert.equal(report.addedSchools, 29); assert.equal(report.activeSchools, 29);
  assert.deepEqual(structuredClone(f.sheets.get('SCHOOLS').rows.slice(1, 3)), before);
});

test('schema mismatch stops before creating missing tables or overwriting any row', () => {
  const f = fixture(); f.sheets.delete('WORKS'); f.sheets.get('SCHOOLS').rows[0][0] = 'CUSTOM_HEADER';
  const before = structuredClone(f.sheets.get('SCHOOLS').rows);
  assert.throws(() => f.context.DETWIL_prepareSchoolRegistration(), { code: 'SCHEMA_MISMATCH' });
  assert.equal(f.sheets.has('WORKS'), false); assert.deepEqual(f.sheets.get('SCHOOLS').rows, before);
});

test('legacy session schema is extended without replacing sessions or resetting passwords', () => {
  const f = fixture(); f.sheets.get('AUTH_SESSIONS').rows = [];
  f.makeSheet('AUTH_SESSIONS', [Array.from(f.schema.AUTH_SESSIONS).slice(0, -1), ['session', 'hash', 'user', 'future', 'created', 'FALSE']]);
  const before = structuredClone(f.sheets.get('AUTH_SESSIONS').rows[1]);
  f.context.DETWIL_prepareSchoolRegistration();
  assert.equal(f.sheets.get('AUTH_SESSIONS').rows[0].at(-1), 'ActiveRoleID');
  assert.deepEqual(f.sheets.get('AUTH_SESSIONS').rows[1], before);
  f.context.DETWIL_owner_ = () => { throw Object.assign(new Error('Not owner'), { code: 'FORBIDDEN' }); };
  assert.throws(() => f.context.DETWIL_prepareSchoolRegistration(), { code: 'FORBIDDEN' });
});
