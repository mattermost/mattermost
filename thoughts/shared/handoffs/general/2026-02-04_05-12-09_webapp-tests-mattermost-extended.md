---
date: 2026-02-04T05:12:09-0500
researcher: Claude
git_commit: 418f64cf14b80a960a3db970c9d61c2dba091450
branch: master
repository: mattermost-extended
topic: "Mattermost Extended Webapp Tests Implementation"
tags: [implementation, testing, webapp, mattermost-extended]
status: in_progress
last_updated: 2026-02-04
last_updated_by: Claude
type: implementation_strategy
---

# Handoff: Webapp Tests for Mattermost Extended Features

## Task(s)
Writing webapp tests for Mattermost Extended features as outlined in the test plan.

**Completed:**
- MultiImageView component tests (ImageMulti/ImageSmaller features)
- SidebarBaseChannelIcon tests (custom channel icons in sidebar)
- HideDeletedMessagePlaceholder tweak tests
- SidebarChannelSettings tweak tests
- HideUpdateStatusButton feature flag tests
- SystemConsoleDarkMode feature flag tests
- SystemConsoleHideEnterprise and SystemConsoleIcons tests

**Remaining (from test plan):**
- ~~Thread feature tests (ThreadsInSidebar, CustomThreadNames)~~ ✅ COMPLETED
- MarkdownImage Captions tests (ImageCaptions)
- E2E tests for UI Tweaks, Threads, Admin Console

## Critical References
- `TEST_PLAN_MATTERMOST_EXTENDED.md` - Master test plan with coverage overview and remaining tests
- `CLAUDE.md` - Project documentation with feature flag and tweak architecture

## Recent changes
- `webapp/channels/src/components/multi_image_view/multi_image_view.test.tsx` - New test file
- `webapp/channels/src/components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel_icon.test.tsx` - New test file
- `webapp/channels/src/tests/mattermost_extended/websocket_post_delete.test.ts` - New test file
- `webapp/channels/src/tests/mattermost_extended/hide_update_status_button.test.ts` - New test file
- `webapp/channels/src/tests/mattermost_extended/sidebar_channel_settings.test.tsx` - New test file
- `webapp/channels/src/tests/mattermost_extended/system_console_dark_mode.test.tsx` - New test file
- `webapp/channels/src/tests/mattermost_extended/admin_sidebar_features.test.tsx` - New test file
- `webapp/channels/src/tests/mattermost_extended/threads_in_sidebar.test.tsx` - New test file (ThreadsInSidebar + cleanMessageForDisplay)
- `webapp/channels/src/tests/mattermost_extended/custom_thread_names.test.tsx` - New test file (CustomThreadNames)
- `TEST_PLAN_MATTERMOST_EXTENDED.md` - Updated coverage status

## Learnings
1. **Keep custom tests separate from upstream files** - Tests for Mattermost Extended features should be in dedicated files/folders (`webapp/channels/src/tests/mattermost_extended/`) rather than modifying upstream test files. This makes maintenance easier when syncing with upstream.

2. **Test patterns used:**
   - Component tests use `@testing-library/react` and `enzyme` (shallow)
   - Feature flag tests mock selectors (`jest.mock('mattermost-redux/selectors/entities/general')`)
   - Config values are strings, compare with `=== 'true'`

3. **Key config patterns:**
   - Feature flags: `config.FeatureFlagXxx === 'true'`
   - Tweaks: `config.MattermostExtendedXxx === 'true'`

4. **Tests cannot run locally** - The canvas native module isn't compiled, causing jsdom failures. Tests should be run via GitHub Actions workflows instead.

## Artifacts
- `webapp/channels/src/components/multi_image_view/multi_image_view.test.tsx`
- `webapp/channels/src/components/sidebar/sidebar_channel/sidebar_base_channel/sidebar_base_channel_icon.test.tsx`
- `webapp/channels/src/tests/mattermost_extended/websocket_post_delete.test.ts`
- `webapp/channels/src/tests/mattermost_extended/hide_update_status_button.test.ts`
- `webapp/channels/src/tests/mattermost_extended/sidebar_channel_settings.test.tsx`
- `webapp/channels/src/tests/mattermost_extended/system_console_dark_mode.test.tsx`
- `webapp/channels/src/tests/mattermost_extended/admin_sidebar_features.test.tsx`
- `webapp/channels/src/tests/mattermost_extended/threads_in_sidebar.test.tsx`
- `webapp/channels/src/tests/mattermost_extended/custom_thread_names.test.tsx`
- `TEST_PLAN_MATTERMOST_EXTENDED.md` (updated)

## Action Items & Next Steps
1. **Write remaining webapp tests:**
   - MarkdownImage Captions tests for ImageCaptions feature (check `webapp/channels/src/components/markdown_image/markdown_image.tsx`)
   - Thread feature tests if ThreadsInSidebar/CustomThreadNames are implemented

2. **Write E2E tests (Cypress):**
   - `e2e-tests/cypress/tests/integration/channels/mattermost_extended/threads_extended_spec.ts`
   - `e2e-tests/cypress/tests/integration/channels/mattermost_extended/ui_tweaks_spec.ts`
   - `e2e-tests/cypress/tests/integration/channels/mattermost_extended/admin_console_extended_spec.ts`

3. **Run tests via GitHub Actions** to verify they pass (local environment has canvas module issues)

## Other Notes
- Test plan at `TEST_PLAN_MATTERMOST_EXTENDED.md:474` has the "Remaining Tests" section with detailed specs
- Existing E2E tests are at `e2e-tests/cypress/tests/integration/channels/mattermost_extended/`
- Reference existing webapp tests like `webapp/channels/src/components/video_player/video_player.test.tsx` for patterns
- The `webapp/channels/src/tests/mattermost_extended/` folder was created for organizing custom feature tests
