import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getAppsScriptHealth } from '../lib/appsScript.ts';

const originalUrl = process.env.APPS_SCRIPT_WEB_APP_URL;
const originalFetch = globalThis.fetch;
const url = 'https://script.google.com/macros/s/test-deployment/exec';
const healthy = {
  ok: true,
  data: {
    system: 'DETWIL',
    spreadsheetConnected: true,
    rootFolderConnected: true,
    schemaOk: true,
    schemaProblems: [],
  },
};

afterEach(() => {
  if (originalUrl === undefined) delete process.env.APPS_SCRIPT_WEB_APP_URL;
  else process.env.APPS_SCRIPT_WEB_APP_URL = originalUrl;
  globalThis.fetch = originalFetch;
});

test('missing configuration does not make a network request', async () => {
  delete process.env.APPS_SCRIPT_WEB_APP_URL;
  globalThis.fetch = () => assert.fail('Unexpected network request');
  assert.deepEqual(await getAppsScriptHealth(), {
    ok: false,
    configured: false,
    error: 'ยังไม่ได้ตั้งค่า APPS_SCRIPT_WEB_APP_URL',
  });
});

test('rejects non-Google URLs and development deployment URLs before fetching', async () => {
  globalThis.fetch = () => assert.fail('Unexpected network request');
  for (const value of ['http://127.0.0.1/', 'https://script.google.com.evil.test/macros/s/id/exec', 'https://script.google.com/macros/s/id/dev']) {
    process.env.APPS_SCRIPT_WEB_APP_URL = value;
    assert.equal((await getAppsScriptHealth()).ok, false);
  }
});

test('successful request includes a timeout and checks the health endpoint', async () => {
  process.env.APPS_SCRIPT_WEB_APP_URL = url;
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(input).searchParams.get('health'), '1');
    assert.equal(init.cache, 'no-store');
    assert.ok(init.signal instanceof AbortSignal);
    return Response.json(healthy);
  };
  const result = await getAppsScriptHealth();
  assert.equal(result.ok, true);
  assert.equal(result.urlHost, 'script.google.com');
});

test('Google login HTML is reported as an access problem', async () => {
  process.env.APPS_SCRIPT_WEB_APP_URL = url;
  globalThis.fetch = async () => new Response('<html>Sign in</html>', { headers: { 'content-type': 'text/html' } });
  const result = await getAppsScriptHealth();
  assert.equal(result.ok, false);
  assert.match(result.error, /JSON/);
});

test('HTTP failures and malformed payloads cannot show connected', async () => {
  process.env.APPS_SCRIPT_WEB_APP_URL = url;
  for (const response of [new Response('', { status: 503 }), Response.json({ ok: true }), Response.json({ ...healthy, data: { ...healthy.data, schemaProblems: 'invalid' } }), Response.json({ ...healthy, data: { ...healthy.data, schemaOk: 'true' } })]) {
    globalThis.fetch = async () => response;
    assert.equal((await getAppsScriptHealth()).ok, false);
  }
});

test('backend envelope success does not hide disconnected Sheets or Drive', async () => {
  process.env.APPS_SCRIPT_WEB_APP_URL = url;
  for (const field of ['spreadsheetConnected', 'rootFolderConnected', 'schemaOk']) {
    globalThis.fetch = async () => Response.json({ ...healthy, data: { ...healthy.data, [field]: false } });
    const result = await getAppsScriptHealth();
    assert.equal(result.ok, false);
    assert.equal(result.data[field], false);
  }
});

test('timeouts become a readable error without exposing request credentials', async () => {
  process.env.APPS_SCRIPT_WEB_APP_URL = url;
  globalThis.fetch = async () => { throw new DOMException('Sensitive URL', 'TimeoutError'); };
  const result = await getAppsScriptHealth();
  assert.equal(result.ok, false);
  assert.match(result.error, /8/);
  assert.ok(!result.error.includes('Sensitive'));
});
