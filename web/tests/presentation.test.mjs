import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { gradeLevels, normalizeGrade, presentation, workThemes, workColors, attachmentHref, updateWorkList } from '../lib/presentation.ts';
import { fileResponseHeaders } from '../lib/fileResponse.ts';

test('grade options cover secondary years 1–6 and normalize supported legacy values', () => {
  assert.equal(gradeLevels.length, 6);
  for (let year = 1; year <= 6; year++) for (const value of [`M${year}`, `ม.${year}`, `ชั้นมัธยมศึกษาปีที่ ${year}`]) assert.equal(normalizeGrade(value), gradeLevels[year - 1]);
  for (const value of ['M7', 'ป.1', '', 'arbitrary']) assert.equal(normalizeGrade(value), '');
});

test('three layouts and five named colors resolve only to trusted CSS values', () => {
  assert.equal(workThemes.length, 3); assert.equal(workColors.length, 5);
  for (const theme of workThemes) for (const color of workColors) assert.equal(presentation(theme.code, color.code).color.color, color.color);
  assert.equal(presentation('evil', 'url(https://evil.invalid)').theme.code, 'classic');
  assert.equal(presentation(undefined, undefined).color.code, 'teal');
});

test('attachment buttons reject executable and credential URLs and preserve private file authorization parameters', () => {
  assert.equal(attachmentHref('', { fileId: 'file' }, true), '');
  const file = new URL(attachmentHref('work/id', { fileId: 'file&id' }, true), 'https://example.org');
  assert.equal(file.searchParams.get('work'), 'work/id'); assert.equal(file.searchParams.get('file'), 'file&id');
  assert.equal(file.searchParams.get('preview'), '1'); assert.equal(file.searchParams.get('inline'), '1');
  for (const url of ['javascript:alert(1)', 'https://user:password@example.org/', 'http://example.org/']) assert.equal(attachmentHref('work', { url }), '');
  assert.equal(attachmentHref('work', { url: 'https://example.org/plan' }), 'https://example.org/plan');
});

test('confirmed saves update a list immediately without duplicating rows or review queues', () => {
  const work = { id: 'w1', approvalStatus: 'DRAFT', content: { title: 'Saved' } };
  const initial = { items: [], total: 0, schools: [] };
  const added = updateWorkList(initial, work, true, false);
  assert.equal(added.total, 1); assert.equal(added.items[0].content.title, 'Saved');
  const edited = updateWorkList(added, { ...work, content: { title: 'Edited' } }, false, false);
  assert.equal(edited.total, 1); assert.equal(edited.items.length, 1); assert.equal(edited.items[0].content.title, 'Edited');
  const queue = updateWorkList({ ...initial, items: [work], total: 1 }, { ...work, approvalStatus: 'SCHOOL_APPROVED' }, false, true);
  assert.equal(queue.total, 0); assert.equal(queue.items.length, 0);
});

test('inline viewing is limited to PDF and raster images; HTML and Office files remain downloads', () => {
  const pdf = fileResponseHeaders("แผน (1)'\r\n.pdf", 'application/pdf', true);
  assert.equal(pdf['Content-Type'], 'application/pdf'); assert.match(pdf['Content-Disposition'], /^inline;/);
  assert.equal(pdf['Cache-Control'], 'private, no-store'); assert.equal(pdf['Content-Security-Policy'], 'sandbox');
  assert.doesNotMatch(pdf['Content-Disposition'], /[\r\n]/); assert.match(pdf['Content-Disposition'], /%27/);
  for (const mime of ['text/html', 'image/svg+xml', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']) {
    const headers = fileResponseHeaders('file', mime, true);
    assert.equal(headers['Content-Type'], 'application/octet-stream'); assert.match(headers['Content-Disposition'], /^attachment;/);
  }
});

test('studio uses one-call bootstrap and confirmed save responses, with a local theme preview', () => {
  const source = readFileSync(new URL('../components/Studio.tsx', import.meta.url), 'utf8');
  const save = source.slice(source.indexOf('async function save('), source.indexOf('async function command('));
  const flow = source.slice(source.indexOf('async function command('), source.indexOf('async function addAttachment('));
  assert.doesNotMatch(save, /loadList/); assert.doesNotMatch(flow, /loadList|"getWork"/);
  assert.match(source, /api<Workspace>\("workspace"/);
  assert.match(source, /includeWorkspace: true/);
  assert.match(source, /"attachFile"/); assert.match(source, /<dialog/); assert.match(source, /gradeLevels.map/);
});
