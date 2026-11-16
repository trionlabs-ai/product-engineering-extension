# Contributing to Product Studio

Thank you for your interest in contributing! Product Studio aims to make software development accessible to everyone, regardless of technical background.

## Getting Started

1. Fork and clone the repository
2. Install dev dependencies and open the extension in VS Code:
   ```bash
   npm install
   code --extensionDevelopmentPath="$(pwd)"
   ```
3. Extension host code lives under `src/`. The webview UI lives under `media/webview/` (`index.html`, `main.css`, `main.js`, and `i18n/es.json` / `i18n/en.json`).
4. Press `Cmd+R` (or `Ctrl+R`) in the Extension Development Host window to reload
5. Before sending a change, run `npm run lint` and `npm test`

## Development Guidelines

### Code Style

- Vanilla JavaScript. Runtime code has no npm dependencies; ESLint, Prettier, and the test runner are dev-only
- Webview HTML, CSS, and JS are separate files loaded with `webview.asWebviewUri` under a nonce Content Security Policy
- Use VS Code theme CSS variables (`var(--vscode-*)`) for colors so the extension looks native in any theme
- SVG icons only — no emoji, no external icon libraries
- Git shell commands are built in `src/host/gitService.js`. Docker commands are built in `src/host/dockerService.js`

### i18n

- Shared UI strings live in `media/webview/i18n/es.json` and `media/webview/i18n/en.json`
- Use the `t('key', {vars})` function to render translated text
- When adding a new language, add a new dictionary and a key for every existing entry

### Adding a New Connector

1. Add the connector to the `connectors` array with `name`, `cat` (category), `detail`, and `logo`
2. Add an SVG logo to the `logos` object
3. Add a detail URL to `toolDetail`
4. If the connector has an API integration, add a message handler in `src/host/messageRouter.js`

### Adding a New Ticket Type

1. Add the type to the `typeLabels` and ticket data structures
2. Define the step flow in `getSteps()` and `renderStepContent()`
3. Update translations

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Test your changes in the Extension Development Host
3. Test in both English and Spanish
4. Update CHANGELOG.md
5. Submit a PR with a clear description of what changed and why

## Reporting Issues

- Use GitHub Issues
- Include your VS Code version and OS
- Include screenshots if it's a UI issue
- Describe the expected vs actual behavior

## Code of Conduct

Be kind, be respectful, be constructive. This project is built for people who are learning — keep that spirit in everything you do.
