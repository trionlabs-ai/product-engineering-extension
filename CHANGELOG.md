# Changelog

All notable changes to Product Studio are documented here.

## [Unreleased]

### Changed
- **Internal structure only.** Split the extension host and webview into modules, load webview assets with a nonce Content Security Policy, and add ESLint plus unit and smoke tests. Commands, settings, copy, and flows are unchanged.
- **Real Git commits.** Opening a ticket creates or switches to `feat/<ticket>-<slug>`. Uncommitted work is committed or stashed only after you choose; nothing is discarded. The commit step lists the files, then commits `feat(<ticket>): <title>` with your existing Git identity. If no identity is set, Product Studio explains how to set it and can save a name and email for this repository only after you type them. A remote is pushed with upstream; there is no force-push, no fake hash, and no commit when a folder or repository is missing.
- **Local project plan.** Describe an idea, review an editable draft of epics and tasks, then save `.product-studio/plan.json` and `PLAN.md`. Task ids stay stable. If no AI model is available, the plan can still be written by hand.

## [1.9.5] - 2026-11-15

### Added
- **Bilingual Demo Visuals (English & Spanish)**: Generated localized flow animations for both English (`media/demo.gif`) and Spanish (`media/demo-es.gif`) with English and Spanish demo datasets.
- **English Flow Demo in README**: README and extension description pages now showcase the English demo animation by default with a direct link to the Spanish version.

## [1.9.4] - 2026-11-15

### Changed
- **Removed Demo Data**: Epics, milestones, and tasks are now empty by default so developers start with a fresh workspace without placeholder data.
- **First Task or Connect Empty State**: When no epics or tasks are present, displays a clean prompt to create your first task, create an epic, or connect your tools.

### Fixed
- **Flow Demo GIF Navigation & Viewport**: Cropped bottom pixels to permanently eliminate any duplicate navigation bar at the bottom of the animation.
- **Sub-header Styling Hierarchy**: Updated ticket and creation sub-navigation bars to use sidebar background rather than matching the global titlebar background, ensuring clean visual distinction.
- **Extension Media Resolution**: Updated repository metadata to ensure the animated demo GIF renders reliably in VS Code and Antigravity IDE extension description tabs.

## [1.9.3] - 2026-11-15

### Fixed
- **README Flow GIF Display**: Updated image URL and repository metadata in `package.json` to `https://github.com/fersiguenza/product-engineering-extension`. Direct raw GitHub image URL ensures seamless rendering across VS Code and Antigravity extension details views.

## [1.9.2] - 2026-11-15

### Changed
- **Clean Two-Path Onboarding Welcome Screen**:
  - Initial view now presents two distinct, uncluttered choice cards before displaying any tool grid:
    1. **New here? Where to start**: Guidance explaining the 3 basics with 1-click **Pick starter stack** and **Customize tools manually** navigation.
    2. **Start locally**: Standalone local mode allowing developers to work on their machine without Jira or external tools in 1 click (**Start in local mode**).
  - Tool selection grid moved to clean dedicated Step 1 without cluttered banners.

## [1.9.1] - 2026-11-15

### Added
- **Full Offline & Local-Only Workflow**:
  - **Start Locally Onboarding Button**: 1-click "Empezar en local" button in onboarding to work standalone without requiring Jira, GitLab, GitHub, or external credentials.
  - **Local Epics & Stories**: Full CRUD capability for Epics and Tasks stored locally in global state with dynamic prefix (`LOCAL-` / `KEY-`).
  - **Local Git Commit Step**: Step 5 now detects local Git repository state (current branch, commit history count).
  - **1-Click Local Git Initialization**: If no Git repo is found in workspace, developers can initialize Git (`git init`) directly from the UI.
  - **Direct Local Commit Action**: Save task changes locally with formatted commit messages (`feat(TASK): title`) without forcing a remote Merge Request.
  - **Updated Animated Demo GIF**: Refreshed `media/demo.gif` in README demonstrating the local onboarding and commit workflow.

## [1.9.0] - 2026-11-14

### Added
- **Full Epics CRUD**:
  - **Create Epic**: `+ Nueva Épica` button opens clean creation screen with Name, Short Key, Goal / Summary, Owner/Lead, Target Milestone, and 7-color palette selection.
  - **Read & Navigate**: Persistent Level 1 overview of all Epics with live progress and Level 2 Epic tasks drill-down.
  - **Update Epic**: Edit button on each Epic card and within the Epic detail view, pre-populating fields for immediate modifications.
  - **Delete Epic with Confirmation**: Delete action with native modal warning dialog; safely unassigns tasks (`epicId = ''`) so tasks are never lost.
  - **Persistence**: Changes saved automatically to VS Code global state via `saveEpics` and restored across reloads.
- **Task Completion Workflow & Direct Toggle**:
  - Tasks now mark properly as `Completado` (Completed) when finishing Step 5 (or Step 4 on Spike) and persist in storage.
  - Interactive circular check button on each task card for 1-click completion toggle (`Completado` <-> `En curso`) with dynamic Epic progress recalculation.
  - In-ticket header status action allowing developers to mark as complete or reopen directly.
- **Modern & Softer Blue Button Styling**:
  - Redesigned `.bp` primary buttons with a modern, softer gradient (`#3b82f6` to `#2563eb`), subtle white border, and soft elevation box shadow.
  - Elevated hover transitions with subtle glow and micro-transform.
  - Soft secondary buttons (`.bs`) and refined task badges.

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
- **AI Category in Onboarding**: Dedicated AI Assistants category (`cAI`) with auto-detection badges (` VS`).

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
