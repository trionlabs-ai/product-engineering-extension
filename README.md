# Product Studio

A simplified, guided workspace for Product Engineers, PMs, designers, QA, and anyone doing "vibecoding" with AI assistance.

Product Studio turns VS Code into an accessible development studio: pick a Jira ticket, work with your connected AI assistant (Claude, GitHub Copilot, Antigravity, Ollama, Continue), test changes, launch local databases in 1 click via Docker, add rich evidence, and submit merge requests — without needing deep software engineering knowledge.

![Product Studio Flow (English)](https://raw.githubusercontent.com/fersiguenza/product-engineering-extension/main/media/demo.gif)

_Available in English and Spanish: [Ver demostración en español](https://raw.githubusercontent.com/fersiguenza/product-engineering-extension/main/media/demo-es.gif)_

## Features

- **Local project plan** — describe an idea, review an editable draft of epics and tasks, then save it in the project folder. No Jira or GitHub account is required. If the editor has no AI model, you can still write the plan by hand.
- **Local & Offline Mode (No Jira/External Tool Required)** — start locally with 1 click; create Epics, stories, and manage commits directly on your machine without needing Jira or a remote Git repository.
- **Epics & Tasks Drill-Down Navigation** — 2-level flow: browse project Epics with live completion progress, click into any Epic to view its tasks, and jump directly into the step-by-step ticket workspace.
- **Full Epics CRUD** — create, view, edit, and delete Epics with native confirmation modals; automatically unassigns tasks safely without data loss.
- **Task Completion Workflow & Direct Toggle** — mark tasks as completed in 1 click directly from the list or complete them automatically upon submitting merge requests.
- **Local Git Commits & Repository Init** — Opening a ticket switches to `feat/<ticket>-<slug>` without discarding uncommitted work. Step 5 initializes Git if needed, shows the files that will be committed, and commits `feat(<ticket>): <title>` with your Git identity. If a remote exists, the branch is pushed with upstream.
- **Guided Onboarding with Beginner Tips** — friendly "¿No sabes por dónde empezar?" tips, 1-click Starter Stack recommendation, and plain-language tool explanations.
- **AI Assistant Hub & Topbar Indicator** — live status indicator on top for your connected AI (Claude, GitHub Copilot, Antigravity, Continue, Ollama, ChatGPT) with 1-click chat invocation.
- **Docker & Local Environment Manager** — launch local databases (PostgreSQL, MySQL, Redis, docker-compose) with 1 click; automated Docker detection & 1-click Homebrew installer.
- **Rich Text Jira Comments & Docs** — markdown toolbar (Bold, Italic, Code, Lists, Checkboxes, H3), live preview, and pre-populated acceptance criteria summaries.
- **Backlog & Task Management** — view all sprint tasks or filter by "Assigned to me", create new tasks, and delete deprecated ones.
- **Ticket-Centric Workflow** — step-by-step guidance from problem definition to acceptance criteria verification.
- **Automated Testing** — AI-generated unit & integration tests alongside interactive localhost previews.
- **Evidence Collection** — native file picker to attach screenshots and validation proof to Jira tickets.
- **1-Click Merge Requests** — create GitLab/GitHub merge requests ready for team review and CI/CD deployment.
- **Spike / Research Flow** — dedicated research flow for architecture investigations and documentation sync (Confluence, Notion, OpenSpec).
- **Figma Integration** — design mockups displayed directly within ticket context.
- **Full Internationalization (i18n)** — seamless English and Spanish support with instant topbar toggle.

## Installation

### From VS Code Marketplace

Search for **Product Studio** in the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`) and click Install.

### From .vsix

```bash
code --install-extension product-studio-1.7.0.vsix --force
```

### From source (development)

```bash
npm install
```

Open this folder in VS Code, press **F5**, and choose **Run Product Studio Extension**.

`npm run lint` checks ESLint and Prettier. `npm test` runs unit tests and a VS Code smoke test that activates the extension and opens the panel. On Linux the smoke test needs a display (`xvfb-run -a npm test`).

## Configuration

Open VS Code Settings (`Cmd+,` / `Ctrl+,`) and search for `Product Studio`:

| Setting                        | Default  | Description                                                                                       |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------- |
| `productStudio.language`       | `auto`   | UI language: `auto`, `es`, or `en`                                                                |
| `productStudio.ai.provider`    | `Claude` | Default AI assistant (`Claude`, `GitHub Copilot`, `Antigravity`, `Continue`, `Ollama`, `ChatGPT`) |
| `productStudio.jira.domain`    | `""`     | Jira Cloud domain (e.g. `your-company.atlassian.net`)                                             |
| `productStudio.git.provider`   | `gitlab` | Git provider: `gitlab` or `github`                                                                |
| `productStudio.git.repository` | `""`     | Repository path (e.g. `org/checkout-service`)                                                     |

## Quick Start Guide

1. Open VS Code. Product Studio launches automatically in a distraction-free view.
2. Complete onboarding: select your tools (or click **Elegir combinación básica** for an instant starter stack).
3. Pick a ticket from the Backlog.
4. Follow the step-by-step flow:
   - **Paso 1: Entender** — read user story, criteria, and view Figma mockup.
   - **Paso 2: Trabajar con IA** — prompt is automatically generated and copied; click to open your AI chat.
   - **Paso 3: Testear** — verify automated tests and review live preview.
   - **Paso 4: Documentar** — review pre-populated Jira comments, format with Markdown toolbar, and attach screenshot evidence.
   - **Paso 5: Merge Request** — submit merge request to GitLab/GitHub.

## Tech Stack

- Native VS Code Extension API (Webviews, Commands, State Storage)
- Pure Vanilla JavaScript & CSS with VS Code Design Tokens (host modules under `src/`, webview files under `media/webview/`)
- Scalable Vector Graphics (SVG) — zero external heavy dependencies, zero emojis
- Integrated Docker CLI & Homebrew subprocess automation

## Publishing

See [docs/PUBLISHING.md](docs/PUBLISHING.md) for instructions on publishing to the VS Code Marketplace.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT — see [LICENSE](LICENSE).
