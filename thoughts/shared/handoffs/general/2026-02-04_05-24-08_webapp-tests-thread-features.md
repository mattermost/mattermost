---
date: 2026-02-04T05:24:08-0500
researcher: Claude
git_commit: 9b520ccc155b6d15d4e1380a63cfd34c6abf3d89
branch: master
repository: mattermost-extended
topic: "Webapp Tests for Thread Features (ThreadsInSidebar, CustomThreadNames)"
tags: [implementation, testing, webapp, threads, mattermost-extended]
status: complete
last_updated: 2026-02-04
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: Webapp Tests for Thread Features

## Task(s)
Writing webapp tests for Mattermost Extended thread features (ThreadsInSidebar and CustomThreadNames).

**Completed:**
- ThreadsInSidebar feature tests - 18 test cases covering config mapping, thread label logic, link generation, unread detection, active thread detection, urgent thread detection
- CustomThreadNames feature tests - 27 test cases covering config mapping, name resolution, edit state management, save logic, keyboard handling, UI state, API format, integration with ThreadsInSidebar
- cleanMessageForDisplay utility tests - 18 test cases for markdown stripping, truncation, whitespace handling

**Remaining (from original test plan):**
- MarkdownImage Captions tests (ImageCaptions feature)
- E2E tests for UI Tweaks, Threads, Admin Console

## Critical References
- `TEST_PLAN_MATTERMOST_EXTENDED.md` - Master test plan with coverage overview and remaining tests
- `CLAUDE.md` - Project documentation with feature flag and tweak architecture

## Recent changes
- `webapp/channels/src/tests/mattermost_extended/threads_in_sidebar.test.tsx` - New test file for ThreadsInSidebar feature and cleanMessageForDisplay utility
- `webapp/channels/src/tests/mattermost_extended/custom_thread_names.test.tsx` - New test file for CustomThreadNames feature
- `TEST_PLAN_MATTERMOST_EXTENDED.md` - Updated coverage status, added detailed test case lists for thread features

## Learnings
1. **Test pattern**: Mattermost Extended tests use a simpler approach - testing core logic directly rather than full component rendering with Provider/Router setup. This avoids complex mocking and is more maintainable. See `webapp/channels/src/tests/mattermost_extended/admin_sidebar_features.test.tsx` for the pattern.

2. **Tests cannot run locally**: The canvas native module isn't compiled for Windows, causing jsdom failures. Tests must be verified via GitHub Actions workflows.

3. **Thread feature implementation details**:
   - ThreadsInSidebar requires CRT (Collapsed Reply Threads) to be enabled
   - CustomThreadNames requires ThreadsInSidebar for the edit UI in ThreadView
   - Custom thread names stored in `thread.props.custom_name`
   - Thread names use `cleanMessageForDisplay()` utility from `components/threading/utils.ts`

4. **Config values are strings**: Always compare with `=== 'true'`, not truthy values

## Artifacts
- `webapp/channels/src/tests/mattermost_extended/threads_in_sidebar.test.tsx`
- `webapp/channels/src/tests/mattermost_extended/custom_thread_names.test.tsx`
- `TEST_PLAN_MATTERMOST_EXTENDED.md` (updated)
- `thoughts/shared/handoffs/general/2026-02-04_05-12-09_webapp-tests-mattermost-extended.md` (previous handoff, updated)

## Action Items & Next Steps
1. **Write MarkdownImage Captions tests** - Check `webapp/channels/src/components/markdown_image/markdown_image.tsx` for ImageCaptions feature implementation
2. **Write E2E tests (Cypress)**:
   - `e2e-tests/cypress/tests/integration/channels/mattermost_extended/threads_extended_spec.ts`
   - `e2e-tests/cypress/tests/integration/channels/mattermost_extended/ui_tweaks_spec.ts`
   - `e2e-tests/cypress/tests/integration/channels/mattermost_extended/admin_console_extended_spec.ts`
3. **Run tests via GitHub Actions** to verify they pass (local environment has canvas module issues)

## Other Notes
- Test plan at `TEST_PLAN_MATTERMOST_EXTENDED.md:476` has the "Remaining Tests" section with detailed specs
- Existing E2E tests are at `e2e-tests/cypress/tests/integration/channels/mattermost_extended/`
- The `webapp/channels/src/tests/mattermost_extended/` folder contains all custom feature tests
- Key implementation files for thread features:
  - `webapp/channels/src/components/sidebar/sidebar_channel/sidebar_thread_item/sidebar_thread_item.tsx` - Thread sidebar rendering
  - `webapp/channels/src/components/threading/thread_view/thread_view.tsx` - Full-width thread view with custom name editing
  - `webapp/channels/src/components/threading/utils.ts` - cleanMessageForDisplay utility
