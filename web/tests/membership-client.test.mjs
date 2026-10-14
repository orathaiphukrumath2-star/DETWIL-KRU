import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { memberApi, MemberApiError } from '../lib/workClient.ts';

test('duplicate-account response keeps its code for the existing-account sign-in action', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ ok: false, error: { code: 'ACCOUNT_EXISTS', message: 'Use the existing account' } }, { status: 409 });
  try {
    await assert.rejects(memberApi('register'), error => error instanceof MemberApiError && error.code === 'ACCOUNT_EXISTS' && error.message === 'Use the existing account');
  } finally { globalThis.fetch = original; }
});

test('login no longer links to Apps Script and the publish button is gated by district approval', () => {
  const studio = readFileSync(new URL('../components/Studio.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(studio, /Apps Script สำหรับผู้ดูแล|script\.google\.com/);
  assert.match(studio, /selected.approvalStatus !== "DISTRICT_APPROVED"/);
  const registration=readFileSync(new URL('../components/Membership.tsx', import.meta.url), 'utf8');
  assert.match(registration,/สมาชิกใช้งานได้ทันที/); assert.doesNotMatch(registration,/บัญชีและคำขอบทบาทรอผู้ดูแลยืนยัน/);
});

test('registration never disables school-role checkboxes solely because the school list is empty', () => {
  const source = readFileSync(new URL('../components/Membership.tsx', import.meta.url), 'utf8');
  const picker = source.slice(source.indexOf('function RolePicker('), source.indexOf('export function Registration('));
  assert.doesNotMatch(picker, /disabled\s*=/);
  assert.match(source, /<fieldset disabled=\{busy\}>/);
  assert.match(picker, /checked=\{chosen.includes\(role\)\}/);
  assert.match(picker, /required/);
});
