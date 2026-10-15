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

test('member requests have a deadline and never automatically repeat mutations', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(init.credentials, 'same-origin');
    assert.equal(init.cache, 'no-store');
    throw new DOMException('deadline', 'TimeoutError');
  };
  try {
    await assert.rejects(memberApi('saveWork'), error => error instanceof MemberApiError && error.code === 'TIMEOUT');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});

test('network failures and non-JSON server responses are understandable errors', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(memberApi('session'), error => error.code === 'NETWORK');
    globalThis.fetch = async () => new Response('<html>Gateway timeout</html>', { status: 504 });
    await assert.rejects(memberApi('passwordLogin'), error => error.code === 'UNAVAILABLE' && !error.message.includes('JSON'));
  } finally { globalThis.fetch = original; }
});

test('session outages are not silently interpreted as a signed-out user; recovery routes are linked', () => {
  const source = readFileSync(new URL('../components/Studio.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\.catch\(\(\) => \{\}\)/);
  assert.match(source, /error.code === "UNAUTHORIZED"/);
  assert.match(source, /sessionUnavailable/);
  assert.match(source, /href="\/forgot-password"/);
  const recovery = readFileSync(new URL('../components/PasswordRecovery.tsx', import.meta.url), 'utf8');
  assert.match(recovery, /identityVerified: true/);
  assert.doesNotMatch(recovery, /localStorage|sessionStorage|setInterval/);
});

test('member school options distinguish loading from empty data and allow explicit retry after failure', () => {
  const source = readFileSync(new URL('../components/Membership.tsx', import.meta.url), 'utf8');
  const profile = source.slice(source.indexOf('export function MemberProfile('), source.indexOf('export function MemberAdmin('));
  assert.match(profile, /loading=\{schoolsLoading\}/);
  assert.match(profile, /setSchoolsAttempt/);
  assert.match(profile, /AbortSignal.timeout\(25000\)/);
  assert.match(profile, /Boolean\(schoolsError\)/);
});
