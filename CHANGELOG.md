# Changelog

All notable changes to Product Studio are documented here.

## [1.8.2] - 2026-11-14

### Added
- **Direct 2-Level Epics & Tasks Drill-Down Navigation**:
  - Level 1: Clean, clickable **Listado de Épicas** (`.epic-card`) displaying each Epic's ID, color, name, quarter milestone, and progress bar (`X/Y tareas`).
  - Click on an Epic: Transitions smoothly into **Tareas de la Épica**, showing the Epic's goal, lead, progress bar, and list of tasks.
  - Click on a Task or "Trabajar ›": Direct entry into the step-by-step ticket workspace (AI prompt -> Coding -> Automated testing -> Review & evidence -> GitLab MR).
  - Breadcrumb back navigation: `‹ Volver al listado de Épicas` to return effortlessly to the main Epics overview.

## [1.8.1] - 2026-11-14

### Changed
- **Simplified & High-Contrast Backlog UI**:
  - Replaced clutter of stacked banners and nested tabs with a clean Linear-style layout.
  - Unified segmented control: **Mis tareas**, **Todas**, and **Roadmap Q1**.
  - Interactive `.task-card` items with smooth hover lift (`transform: translateY(-1px)`), clear focus border, and 100% clickable hit target.
  - Eliminated badge clutter: clean status pill on left, monospace ID + title, and compact subline showing Epic pill, automated tests count, and screenshots.
  - Fast horizontal Epic filter chips (*Todas las Epics*, *Pasarela Pagos*, *Facturación*, *Rendimiento*) for instant 1-click filtering.
  - Compact `+ Nueva tarea` button integrated into top header.

## [1.8.0] - 2026-11-14

### Added
- **Epics & Milestones Roadmap in Cards View**:
  - View switcher tabs: **Tarjetas** (Cards), **Por Epic** (Grouped by Epic), and **Roadmap & Milestones** (Visual timeline).
  - Roadmap & Milestone summary strip at the top of cards view showing current active milestone progress, target date, and completion bar.
  - Epic badges (`EPIC-10`, `EPIC-12`, `EPIC-15`) and quarterly milestone tags on every card.
  - Dedicated Epics grouped view with dynamic progress calculation based on task status.
  - Interactive Milestones Roadmap tracking Q4, Q1, and Q2 deliverables with associated Epics and tasks.
  - Epic selection dropdown in the Create Task form.
- **Automated Tests Generation with AI**:
  - Step 3 testing view displays detailed automated test suites with execution duration and passed badges.
  - 1-click **Generar más tests automáticos (IA)** button generating edge cases, input sanitization, and resilience tests on the fly.
  - Test pass counter dynamically re-evaluating test coverage.
- **Pre-attached Screen Captures from Test Runner**:
  - Visual Playwright E2E test capture artifacts pre-populated automatically in Step 3 and Step 4 review.
  - Vector SVG browser mockups rendering sharp UI preview thumbnails for screenshots.
  - 1-click **Tomar más capturas automáticas (Playwright)** to simulate additional test captures.
  - Pre-populated Jira comments including acceptance criteria, passed automated tests list, and all attached test screenshot artifacts.

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
