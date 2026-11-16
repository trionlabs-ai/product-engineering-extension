const assert = require('assert');
const vscode = require('vscode');

async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail('timed out after ' + timeoutMs + 'ms');
}

async function run() {
  const extension = vscode.extensions.getExtension('product-engineering.product-studio');
  assert.ok(extension, 'Product Studio should be loaded in the test host');
  const api = await extension.activate();
  assert.strictEqual(extension.isActive, true);

  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('productStudio.open'));
  assert.ok(commands.includes('productStudio.createTask'));
  assert.ok(commands.includes('productStudio.resetOnboarding'));

  await vscode.commands.executeCommand('productStudio.open');
  await waitFor(() => api && api.isUiReady && api.isUiReady(), 8000);

  const labels = vscode.window.tabGroups.all.flatMap((group) => group.tabs.map((tab) => tab.label));
  assert.ok(
    labels.some((label) => String(label).includes('Product Studio')),
    'expected the Product Studio panel tab, saw: ' + labels.join(', ')
  );
}

module.exports = { run };
