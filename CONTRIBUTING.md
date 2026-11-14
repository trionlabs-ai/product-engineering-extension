# Contributing to Product Studio

Thank you for your interest in contributing! Product Studio aims to make software development accessible to everyone, regardless of technical background.

## Getting Started

1. Fork and clone the repository
2. Open the extension in VS Code:
   ```bash
   code --extensionDevelopmentPath="$(pwd)"
   ```
3. Make your changes to `extension.js`
4. Press `Cmd+R` (or `Ctrl+R`) in the Extension Development Host window to reload

## Development Guidelines

### Code Style
- Vanilla JavaScript, no build step, no external dependencies
- All UI HTML is embedded in `extension.js` as template literals
- Use VS Code theme CSS variables (`var(--vscode-*)`) for colors so the extension looks native in any theme
- SVG icons only — no emoji, no external icon libraries

### i18n
- All user-facing strings must be in the `i18n` object with both `es` and `en` keys
- Use the `t('key', {vars})` function to render translated text
- When adding a new language, add a new key to every entry in the `i18n` object

### Adding a New Connector
1. Add the connector to the `connectors` array with `name`, `cat` (category), `detail`, and `logo`
2. Add an SVG logo to the `logos` object
3. Add a detail URL to `toolDetail`
4. If the connector has an API integration, add message handlers in `extension.js` `activate()`

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
