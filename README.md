# Product Studio

A simplified IDE experience for Product Engineers, designers, QA, and non-technical roles who want to build software products (vibecoding) using AI assistance.

Product Studio turns VS Code into a guided workspace: pick a Jira ticket, chat with your AI assistant (Claude, Copilot, or Antigravity), test changes, add evidence, and submit a merge request — all without writing a single line of code yourself.

## Features

- **Guided onboarding** — connect your tools (Jira, GitLab/GitHub, Figma, Confluence, Notion, Supabase, Grafana, AWS, and more) with a searchable connector catalog
- **Ticket-centric workflow** — select a task and follow a step-by-step flow from understanding to delivery
- **AI-powered development** — context is automatically sent to your AI chat (Claude, Copilot, or Antigravity) so you can describe what you need in plain language
- **Automated testing** — AI generates and runs tests based on your acceptance criteria
- **Live preview** — see changes in real time before submitting
- **Evidence & review** — attach screenshots and comments directly to Jira
- **Merge requests** — create GitLab/GitHub merge requests with one click; CI/CD handles deployment
- **Spike / research tickets** — a dedicated flow for investigation tasks with documentation output to Confluence, Notion, or OpenSpec
- **Figma integration** — view linked designs alongside the ticket description
- **Task management** — create, edit, and delete tasks directly, or sync with Jira
- **i18n** — full English and Spanish support, auto-detected from VS Code locale
- **Multi-project** — switch between projects or add new ones anytime

## Installation

### From VS Code Marketplace

Search for **Product Studio** in the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`) and click Install.

### From source (development)

Open `.product-studio-extension/` as a folder in VS Code, then press **F5** and choose **Run Product Studio Extension**. The Extension Development Host opens this repository so you can test Product Studio alongside the course project. Changes to `extension.js` can be reloaded in the host with **Cmd+R** (macOS) or **Ctrl+R** (Windows/Linux).

If the VS Code command-line launcher is installed, you can also start the Extension Development Host from the repository root:

```bash
code --extensionDevelopmentPath="$(pwd)/.product-studio-extension" "$(pwd)"
```

### From .vsix

```bash
npx @vscode/vsce package
code --install-extension product-studio-1.3.0.vsix
```

## Configuration

Open VS Code Settings and search for `Product Studio`:

| Setting | Default | Description |
|---------|---------|-------------|
| `productStudio.language` | `auto` | UI language: `auto`, `es`, or `en` |
| `productStudio.jira.domain` | — | Jira Cloud domain (e.g. `your-company.atlassian.net`) |
| `productStudio.git.provider` | `gitlab` | `gitlab` or `github` |
| `productStudio.git.repository` | — | Repository path (e.g. `org/checkout-service`) |

## Usage

1. Open VS Code
2. Product Studio opens automatically and hides the left sidebar (Explorer). To open it again, run **Product Studio: Open** from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
3. Complete the onboarding: select your tools and connect Jira + your repo
4. Pick a ticket from "My tasks"
5. Follow the guided steps:
   - **Understand** — read the task description and criteria
   - **Work** — ask your AI to implement changes (prompts are copied to your clipboard)
   - **Test** — review AI-generated automated tests + manual live preview
   - **Review** — add screenshots and comments for Jira
   - **Submit** — create a merge request on GitLab/GitHub

For **Spike** tickets (research/investigation), the flow is:
   - **Understand** — read the objective
   - **Investigate** — research with AI assistance
   - **Document** — publish findings to Confluence, Notion, or OpenSpec
   - **Share** — close the ticket with documentation

## Tech Stack

- VS Code Extension API (Webview panels)
- Vanilla JavaScript (no build step required)
- CSS with VS Code theme variables for native look & feel
- SVG icons (no emoji, no external icon libraries)

## Publishing

See [docs/PUBLISHING.md](docs/PUBLISHING.md) for instructions on publishing to the VS Code Marketplace.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE).
