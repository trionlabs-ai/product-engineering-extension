const assert = require('assert');
const test = require('node:test');
const { runFile } = require('../../src/host/process');

test('runFile passes shell metacharacters through as one literal argument', async () => {
  const payload = 'say "hello" $(whoami) `id` ; rm -rf / && echo\nnext';
  const result = await runFile(process.execPath, [
    '-e',
    'process.stdout.write(process.argv[1])',
    payload,
  ]);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.stdout, payload);
});
