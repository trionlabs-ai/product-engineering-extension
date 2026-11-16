const assert = require('assert');
const test = require('node:test');
const {
  buildChatCommands,
  buildChatStatusMessage,
  triggerAiChat,
} = require('../../src/host/aiChat');

test('claude commands keep the original order and the generic fallbacks', () => {
  const commands = buildChatCommands('Claude', 'implement the ticket');
  assert.strictEqual(commands[0].cmd, 'claude-vscode.sidebar.open');
  assert.strictEqual(commands[6].cmd, 'claude-dev.SidebarProvider.focus');
  assert.deepStrictEqual(commands[commands.length - 4], {
    cmd: 'workbench.action.chat.open',
    args: { query: 'implement the ticket' },
  });
  assert.strictEqual(commands[commands.length - 1].cmd, 'workbench.panel.chat.view.copilot.focus');
});

test('copilot passes the prompt only when it is non-empty', () => {
  const withPrompt = buildChatCommands('GitHub Copilot', 'hello');
  const open = withPrompt.find((item) => item.cmd === 'workbench.action.chat.open');
  assert.deepStrictEqual(open.args, { query: 'hello' });
  const empty = buildChatCommands('GitHub Copilot', '');
  const openEmpty = empty.find((item) => item.cmd === 'workbench.action.chat.open');
  assert.strictEqual(openEmpty.args, undefined);
});

test('antigravity and ollama keep their command names', () => {
  assert.strictEqual(buildChatCommands('Antigravity', '')[0].cmd, 'antigravity.chat.focus');
  assert.strictEqual(buildChatCommands('Gemini', '')[2].cmd, 'google.gemini.chat.focus');
  assert.strictEqual(buildChatCommands('Ollama', '')[0].cmd, 'ollama-chat.ollamaChat');
  assert.strictEqual(buildChatCommands('ChatGPT', '')[0].cmd, 'workbench.action.chat.open');
});

test('status copy stays in Spanish and English', () => {
  assert.strictEqual(
    buildChatStatusMessage('es', 'Claude', true),
    'Chat de Claude abierto y prompt copiado. Pega con Cmd+V / Ctrl+V.'
  );
  assert.strictEqual(
    buildChatStatusMessage('en', 'Claude', false),
    'Prompt copied. Open Claude chat and paste with Cmd+V / Ctrl+V.'
  );
});

test('triggerAiChat stops at the first command that succeeds', async () => {
  const executed = [];
  const vscode = {
    env: { clipboard: { writeText: async () => {} } },
    commands: {
      executeCommand: async (cmd) => {
        executed.push(cmd);
        if (cmd !== 'claude-vscode.focus') throw new Error('missing');
      },
    },
    window: { showInformationMessage() {} },
  };
  const opened = await triggerAiChat(vscode, 'prompt', 'en', 'Claude');
  assert.strictEqual(opened, true);
  assert.deepStrictEqual(executed, ['claude-vscode.sidebar.open', 'claude-vscode.focus']);
});
