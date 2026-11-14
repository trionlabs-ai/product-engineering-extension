# Changelog

All notable changes to Product Studio are documented here.

## [1.7.0] - 2026-11-14

### Added
- **AI Assistant Hub & Topbar Indicator**: Real-time status dot and 1-click launcher for active AI assistant (Claude, GitHub Copilot, Google Antigravity, Continue, Ollama, ChatGPT).
- **Direct Assistant Command Dispatch**: Targeted invocation of provider commands (`claude-vscode.sidebar.open`, `workbench.panel.chat.view.copilot.focus`, `ollama-chat.ollamaChat`).
- **Onboarding Beginner Guidance**: Friendly "¿No sabes por dónde empezar?" banner with 1-click Starter Stack selector (AI + Jira + Repo + Figma).
- **Plain-Language Tool Tips**: Expandable tooltips and card descriptions explaining every tool in simple terms for non-technical users.
- **AI Category in Onboarding**: Dedicated AI Assistants category (`cAI`) with auto-detection badges (`✓ VS`).

## [1.6.0] - 2026-11-14

### Added
- **Rich Text Markdown Toolbar**: Toolbar for Jira comments and documentation (Bold, Italic, Inline Code, Lists, Checkboxes, Headings).
- **Live Markdown Preview**: Toggle between editor and interactive formatted preview with stylized checkboxes and code blocks.
- **Pre-populated Jira Comments**: Structured review summaries generated automatically from acceptance criteria and testing status.
- **2-3 Column Tool Grid**: Responsive CSS grid in onboarding replacing single-column list.
- **Category Filter Pills**: Fast category filtering (*Todas*, *Populares*, *Gestión de proyecto*, *Código*, *Diseño*, *Base de datos*).

## [1.5.0] - 2026-11-14

### Added
- **Docker & Local Environment Manager (`sEnv`)**: Dedicated screen and topbar status indicator for local databases and containers.
- **1-Click Local Databases**: Instant launch for PostgreSQL (`5432`), MySQL (`3306`), Redis (`6379`), and `docker compose up -d`.
- **Automated Docker Detection**: Real-time checks for Docker CLI and running daemon.
- **1-Click Homebrew macOS Installer**: Automated installation in integrated terminal with `brew install --cask docker`.
- **Active Container Monitor**: Live listing with individual container stop controls.

## [1.4.0] - 2026-11-14

### Added
- New connectors: Asana, ClickUp, PostgreSQL, MySQL.
- Backlog tabs: "Todas" (All) and "Asignadas a mí" (Assigned to me).
- Native file picker for evidence screenshots via `vscode.window.showOpenDialog`.
- External link opening in system browser for Jira and repository URLs.
- Multi-extension chat cascade with clipboard synchronization.
- Automated detection of installed extensions (`GitLab.gitlab-workflow`, `GitHub.vscode-pull-request-github`, `Atlassian.atlascode`).

## [1.3.0] - 2026-11-14

### Added
- Task management: create and delete tasks directly from Product Studio
- Searchable connector catalog in onboarding (Jira, GitLab, GitHub, Figma, Confluence, Notion, OpenSpec, Supabase, Firebase, Grafana, AWS, GCP)
- Spike/investigation ticket flow with documentation output (Confluence, Notion, OpenSpec)
- Figma design preview linked to implementation tickets
- Full i18n support: English and Spanish, auto-detected from VS Code locale
- Language toggle (ES/EN) in the top bar
- Multi-project support: "New project" button always accessible
- AI-automated test generation and execution
- Evidence workflow: screenshots and comments attached to Jira
- Live preview step for manual testing
- Open source repo structure: README, LICENSE (MIT), CONTRIBUTING, CHANGELOG

### Changed
- Redesigned from 3-column dashboard to single-column step-by-step wizard
- Simplified UI for non-technical users (no jargon, large buttons, one thing at a time)
- Replaced all emoji with SVG icons and official brand logos
- Chat is no longer built into the extension; context syncs with native AI chat (Claude, Copilot, Antigravity)

## [0.9.0] - 2024-XX-XX

### Added
- Initial 3-column layout (sidebar + ticket canvas + AI chat)
- Jira ticket selection from sidebar
- Live preview of application changes
- Merge Request creation for GitLab
- Evidence attachment to Jira

## [0.4.0] - 2024-XX-XX

### Added
- Initial onboarding wizard for tool connections
- Sidebar webview with ticket list
- Configuration properties for Jira, Git, Supabase, AWS, Grafana
