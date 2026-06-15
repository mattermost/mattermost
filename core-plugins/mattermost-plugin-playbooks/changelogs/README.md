# Changelogs for mattermost-plugin-playbooks

This directory contains generated changelogs for each release, complete with QA review guidance.

## Structure

Each changelog file is named `<from-version>-<to-version>.md` (e.g., `v2.7.0-v2.8.0.md`).

## Changelog Sections

### Standard Sections
- **Summary** — Overview of the release (features, fixes, improvements, breaking changes)
- **Bug Fixes** — Issues that were resolved
- **Features** — New user-facing functionality
- **UI Improvements** — Visual or UX changes
- **Performance** — Speed and optimization improvements
- **Infrastructure** — CI, build system, load testing changes
- **Chores / Maintenance** — Dependencies, refactors, test improvements, translations
- **Commit List** — All commits in the range
- **Recommended Next Version** — Semver suggestion and reasoning

### 🧪 QA Review Checklist (NEW)

**Purpose:** Help QA prioritize and efficiently test RC releases by calling out UI-facing changes.

**What gets included:**
- ✅ New features affecting the UI
- ✅ Bug fixes that change user workflows
- ✅ Navigation and menu changes
- ✅ Visual/branding updates
- ❌ Internal refactors
- ❌ Dependency updates
- ❌ Test improvements
- ❌ Translations

**Information provided for each change:**
1. **PR number and author** — For questions or deeper context
2. **What to test** — Specific steps QA should follow
3. **Impact area(s)** — Where in the UI this change appears (RHS, Modal, Sidebar, etc.)
4. **Regression risk** — High/Medium/Low to help QA prioritize effort

### Organization

The QA section is organized by impact type:
- **Critical UI Changes** — New features, significant fixes, must-test items
- **Visual / UX Changes** — Styling, layout, branding updates
- **Navigation / Flow Changes** — Menu items, routing, link behavior



## For Release Engineers

When generating a new changelog:

1. **Use the standard changelog skill** (see `.pi/skills/changelog/SKILL.md`)
2. **Extract UI-facing PRs** — Identify which PRs changed the UI
3. **Populate QA section** — For each UI PR, add:
   - PR number and author
   - Clear description
   - Test guidance (specific steps or areas)
   - Impact location
   - Regression risk level
4. **Save the file** — `changelogs/<from>-<to>.md`

## For QA Leads

When preparing to test an RC:

1. **Read the QA Review Checklist first** — This tells you what changed and where
2. **Prioritize by Regression Risk** — High-risk items get more thorough testing
3. **Use "What to test" guidance** — Follow the specific steps listed for each change
4. **Know the PR authors** — Reach out if you find issues or need clarification
5. **Check "Impact area(s)"** — Focus your regression testing on these zones

## Tips

- **Each PR entry includes the author** so QA can ask follow-up questions
- **"What to test" is specific** — Not vague; includes actual user workflows
- **Regression risk helps triage** — High-risk fixes get more test coverage
- **Impact areas are consistent** — Helps QA mentally map the app
