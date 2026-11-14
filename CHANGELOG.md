# Changelog

All notable changes to Product Studio are documented here.

## [1.3.0] - 2024-XX-XX

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
