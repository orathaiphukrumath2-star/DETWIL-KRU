import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

test('HTTP setup requests cannot execute the editor-only setup function', () => {
  const context = vm.createContext({
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    DETWIL_jsonError: (code, message) => ({ ok: false, error: { code, message } }),
    DETWIL_setupNewProject: () => assert.fail('Public HTTP must not trigger setup'),
    DETWIL_handleError: () => assert.fail('Setup should be explicitly rejected'),
  });
  vm.runInContext(readFileSync(new URL('../../apps-script/Code.gs', import.meta.url), 'utf8'), context);
  const output = context.doPost({ postData: { contents: JSON.stringify({ action: 'setup' }) } });
  const body = JSON.parse(output.text);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, 'EDITOR_ONLY');
});
