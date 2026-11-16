function queryArgs(prompt) {
  return prompt ? { query: prompt } : undefined;
}

function buildChatCommands(provider, prompt) {
  const pLower = (provider || '').toLowerCase();
  let chatCommands = [];

  if (pLower.includes('claude')) {
    chatCommands = [
      { cmd: 'claude-vscode.sidebar.open' },
      { cmd: 'claude-vscode.focus' },
      { cmd: 'claude-vscode.newConversation' },
      { cmd: 'claude-vscode.editor.open' },
      { cmd: 'claude.focus' },
      { cmd: 'claude.openChat' },
      { cmd: 'claude-dev.SidebarProvider.focus' },
    ];
  } else if (pLower.includes('copilot')) {
    chatCommands = [
      { cmd: 'workbench.panel.chat.view.copilot.focus' },
      { cmd: 'github.copilot.chat.focus' },
      { cmd: 'workbench.action.chat.open', args: queryArgs(prompt) },
      { cmd: 'workbench.action.quickchat.open', args: queryArgs(prompt) },
    ];
  } else if (pLower.includes('antigravity') || pLower.includes('gemini')) {
    chatCommands = [
      { cmd: 'antigravity.chat.focus' },
      { cmd: 'antigravity.openChat' },
      { cmd: 'google.gemini.chat.focus' },
      { cmd: 'cloudcode.gemini.focus' },
    ];
  } else if (pLower.includes('continue')) {
    chatCommands = [
      { cmd: 'continue.focusContinueInputView' },
      { cmd: 'continue.continueGUIView.focus' },
    ];
  } else if (pLower.includes('ollama')) {
    chatCommands = [{ cmd: 'ollama-chat.ollamaChat' }, { cmd: 'workbench.view.extension.ollama' }];
  }

  chatCommands.push(
    { cmd: 'workbench.action.chat.open', args: queryArgs(prompt) },
    { cmd: 'workbench.action.quickchat.open', args: queryArgs(prompt) },
    { cmd: 'claude-vscode.sidebar.open' },
    { cmd: 'workbench.panel.chat.view.copilot.focus' }
  );

  return chatCommands;
}

function buildChatStatusMessage(lang, ai, opened) {
  return lang === 'es'
    ? opened
      ? `Chat de ${ai} abierto y prompt copiado. Pega con Cmd+V / Ctrl+V.`
      : `Prompt copiado. Abre el chat de ${ai} y pega con Cmd+V / Ctrl+V.`
    : opened
      ? `${ai} chat opened & prompt copied. Paste with Cmd+V / Ctrl+V.`
      : `Prompt copied. Open ${ai} chat and paste with Cmd+V / Ctrl+V.`;
}

async function triggerAiChat(vscode, prompt, lang, provider) {
  if (prompt) {
    try {
      await vscode.env.clipboard.writeText(prompt);
    } catch (_) {
      // Clipboard can be unavailable; the chat command is still attempted.
    }
  }

  const ai = provider || 'Claude';
  const chatCommands = buildChatCommands(ai, prompt);
  let opened = false;
  for (const item of chatCommands) {
    try {
      if (item.args) {
        await vscode.commands.executeCommand(item.cmd, item.args);
      } else {
        await vscode.commands.executeCommand(item.cmd);
      }
      opened = true;
      break;
    } catch (_) {
      // Try the next known chat command for this assistant.
    }
  }

  vscode.window.showInformationMessage(buildChatStatusMessage(lang, ai, opened));
  return opened;
}

module.exports = {
  buildChatCommands,
  buildChatStatusMessage,
  triggerAiChat,
};
