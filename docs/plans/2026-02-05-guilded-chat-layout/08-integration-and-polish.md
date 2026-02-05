# 08 - Integration & Polish

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire all components together, handle edge cases, ensure feature flag correctly enables/disables all functionality, and perform final testing.

**Architecture:** Verify all conditional rendering based on Guilded layout flag. Handle transitions between Guilded and non-Guilded modes. Ensure mobile fallback works. Polish animations and transitions.

**Tech Stack:** React, Redux, TypeScript, SCSS

**Depends on:** All previous subplans (01-07)

---

## Task 1: Verify Feature Flag Integration

**Files:**
- Review: All components using `useGuildedLayout` hook

**Step 1: Audit all Guilded-related components**

Ensure each component properly checks the feature flag:

```typescript
// Each component should have:
import {useGuildedLayout} from 'hooks/use_guilded_layout';

const isGuildedLayout = useGuildedLayout();

// And render conditionally:
if (!isGuildedLayout) {
    return <OriginalComponent />;
}
return <GuildedComponent />;
```

**Step 2: Create checklist of components**

- [ ] `GuildedTeamSidebar` - Only rendered when Guilded mode
- [ ] `DmListPage` - Only rendered when Guilded mode + DM mode
- [ ] `PersistentRhs` - Only rendered when Guilded mode
- [ ] `EnhancedChannelRow` - Only used when Guilded mode
- [ ] `EnhancedDmRow` - Only used when Guilded mode
- [ ] `GuildedModalsContainer` - Only rendered when Guilded mode
- [ ] Channel header buttons - Modal vs RHS based on mode

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: ensure all components properly check Guilded layout flag"
```

---

## Task 2: Handle Mode Transitions

**Files:**
- Modify: `webapp/channels/src/actions/views/guilded_layout.ts`

**Step 1: Add cleanup actions for mode transitions**

When toggling out of DM mode or disabling Guilded layout:

```typescript
// Add to existing actions file

import {closeGuildedModal} from './guilded_layout';

/**
 * Clean up Guilded layout state when disabling
 */
export function cleanupGuildedLayout(): ActionFuncAsync {
    return async (dispatch) => {
        // Close any open modals
        dispatch(closeGuildedModal());

        // Reset to channel mode
        dispatch(setDmMode(false));

        // Collapse team sidebar
        dispatch(setTeamSidebarExpanded(false));

        // Reset RHS tab
        dispatch(setRhsTab('members'));

        return {data: true};
    };
}

/**
 * Called when navigating away from DMs back to channels
 */
export function exitDmMode(): ActionFuncAsync {
    return async (dispatch) => {
        dispatch(setDmMode(false));
        return {data: true};
    };
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/actions/views/guilded_layout.ts
git commit -m "feat: add cleanup actions for Guilded layout transitions"
```

---

## Task 3: Handle Mobile Fallback

**Files:**
- Modify: `webapp/channels/src/hooks/use_guilded_layout.ts`

**Step 1: Ensure mobile detection is robust**

```typescript
// Update useGuildedLayout hook

import {useEffect, useState, useCallback} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {cleanupGuildedLayout} from 'actions/views/guilded_layout';

const MOBILE_BREAKPOINT = 768;

export function useGuildedLayout(): boolean {
    const dispatch = useDispatch();
    const config = useSelector(getConfig);
    const isFeatureEnabled = config.FeatureFlagGuildedChatLayout === 'true';

    const [isDesktop, setIsDesktop] = useState(() => {
        if (typeof window === 'undefined') {
            return true;
        }
        return window.innerWidth >= MOBILE_BREAKPOINT;
    });

    const [wasGuildedActive, setWasGuildedActive] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleResize = () => {
            const newIsDesktop = window.innerWidth >= MOBILE_BREAKPOINT;
            setIsDesktop(newIsDesktop);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isGuildedActive = isFeatureEnabled && isDesktop;

    // Clean up when transitioning from Guilded to non-Guilded
    useEffect(() => {
        if (wasGuildedActive && !isGuildedActive) {
            dispatch(cleanupGuildedLayout() as any);
        }
        setWasGuildedActive(isGuildedActive);
    }, [isGuildedActive, wasGuildedActive, dispatch]);

    return isGuildedActive;
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/hooks/use_guilded_layout.ts
git commit -m "fix: improve mobile fallback with cleanup on transition"
```

---

## Task 4: Add Layout Transition Animations

**Files:**
- Create: `webapp/channels/src/sass/components/_guilded-transitions.scss`

**Step 1: Create transition styles**

```scss
// _guilded-transitions.scss

// Smooth transitions when Guilded layout is toggled
.guilded-layout-enter {
    opacity: 0;
    transform: translateX(-20px);
}

.guilded-layout-enter-active {
    opacity: 1;
    transform: translateX(0);
    transition: opacity 200ms ease, transform 200ms ease;
}

.guilded-layout-exit {
    opacity: 1;
    transform: translateX(0);
}

.guilded-layout-exit-active {
    opacity: 0;
    transform: translateX(-20px);
    transition: opacity 200ms ease, transform 200ms ease;
}

// DM mode transition
.dm-mode-enter {
    opacity: 0;
}

.dm-mode-enter-active {
    opacity: 1;
    transition: opacity 150ms ease;
}

.dm-mode-exit {
    opacity: 1;
}

.dm-mode-exit-active {
    opacity: 0;
    transition: opacity 150ms ease;
}

// Team sidebar expand animation
.team-sidebar-expand-enter {
    width: 72px;
}

.team-sidebar-expand-enter-active {
    width: 240px;
    transition: width 200ms ease;
}

.team-sidebar-expand-exit {
    width: 240px;
}

.team-sidebar-expand-exit-active {
    width: 72px;
    transition: width 200ms ease;
}
```

**Step 2: Import in main styles**

Add to main SCSS imports:

```scss
@import 'components/guilded-transitions';
```

**Step 3: Commit**

```bash
git add webapp/channels/src/sass/components/_guilded-transitions.scss
git commit -m "feat: add layout transition animations"
```

---

## Task 5: Handle Edge Cases

**Files:**
- Various components

**Step 1: Handle no current channel**

In components that depend on current channel:

```typescript
const channel = useSelector(getCurrentChannel);

if (!channel) {
    return <LoadingPlaceholder />;
}
```

**Step 2: Handle empty member list**

In MembersTab:

```typescript
if (!groupedMembers || totalMemberCount === 0) {
    return (
        <div className='members-tab--empty'>
            <span>Loading members...</span>
        </div>
    );
}
```

**Step 3: Handle thread loading states**

In ThreadsTab:

```typescript
const isLoading = useSelector(getThreadsLoading);

if (isLoading) {
    return <LoadingSpinner />;
}
```

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: handle edge cases in Guilded layout components"
```

---

## Task 6: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add comprehensive documentation**

Add to Current Feature Flags table:

```markdown
| `GuildedChatLayout` | Guilded-style layout with enhanced team sidebar, DM page, persistent RHS | `MM_FEATUREFLAGS_GUILDEDCHATLAYOUT=true` |
```

Add new section:

```markdown
### Guilded Chat Layout

When `GuildedChatLayout` is enabled:

**Team Sidebar (far left):**
- DM button opens dedicated DM page
- Unread DM avatars with notification badges
- Favorited teams section
- Click to expand (overlay, 240px)

**LHS (Channel List / DM List):**
- Enhanced rows with message preview, timestamp, typing indicator
- Switches between Channels and DMs based on context

**RHS (Persistent Member List):**
- Members tab: Discord-style grouping by status/role
- Threads tab: Active threads in channel
- Hidden for 1:1 DMs, shows participants for Group DMs

**Modal Popouts:**
- Channel Info, Pinned Posts, Files, Search, Edit History

**Auto-enabled:**
- `ThreadsInSidebar` is automatically enabled

**Mobile:**
- Disabled on viewports < 768px, falls back to stock Mattermost
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add comprehensive GuildedChatLayout documentation"
```

---

## Task 7: Create E2E Test Specs

**Files:**
- Create: `e2e-tests/cypress/tests/integration/channels/mattermost_extended/guilded_layout_spec.ts`

**Step 1: Create test file**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

describe('Guilded Chat Layout', () => {
    before(() => {
        // Enable GuildedChatLayout feature flag
        cy.apiUpdateConfig({
            FeatureFlags: {
                GuildedChatLayout: true,
            },
        });
    });

    beforeEach(() => {
        cy.apiInitSetup().then(({team, user}) => {
            cy.apiLogin(user);
            cy.visit(`/${team.name}/channels/town-square`);
        });
    });

    describe('Team Sidebar', () => {
        it('MM-EXT-GL001 should show DM button in team sidebar', () => {
            cy.get('.guilded-team-sidebar .dm-button').should('exist');
        });

        it('MM-EXT-GL002 should expand team sidebar on click', () => {
            cy.get('.guilded-team-sidebar').should('have.css', 'width', '72px');
            cy.get('.guilded-team-sidebar').click();
            cy.get('.expanded-overlay').should('exist');
        });

        it('MM-EXT-GL003 should collapse on outside click', () => {
            cy.get('.guilded-team-sidebar').click();
            cy.get('.expanded-overlay').should('exist');
            cy.get('body').click(500, 500);
            cy.get('.expanded-overlay').should('not.exist');
        });
    });

    describe('DM Mode', () => {
        it('MM-EXT-GL004 should switch to DM list when DM button clicked', () => {
            cy.get('.dm-button').click();
            cy.get('.dm-list-page').should('exist');
            cy.get('.dm-list-header__title').should('contain', 'Direct Messages');
        });

        it('MM-EXT-GL005 should return to channels on back button', () => {
            cy.get('.dm-button').click();
            cy.get('.dm-list-header__back').click();
            cy.get('.dm-list-page').should('not.exist');
        });
    });

    describe('Persistent RHS', () => {
        it('MM-EXT-GL006 should show Members/Threads tabs', () => {
            cy.get('.rhs-tab-bar').should('exist');
            cy.get('.rhs-tab-bar__tab').should('have.length', 2);
        });

        it('MM-EXT-GL007 should switch between tabs', () => {
            cy.get('.rhs-tab-bar__tab').eq(1).click(); // Threads tab
            cy.get('.threads-tab').should('exist');
            cy.get('.rhs-tab-bar__tab').eq(0).click(); // Members tab
            cy.get('.members-tab').should('exist');
        });

        it('MM-EXT-GL008 should hide RHS for DMs', () => {
            // Navigate to a DM
            cy.get('.dm-button').click();
            // Click on a DM conversation
            // RHS should be hidden
            cy.get('.persistent-rhs').should('not.exist');
        });
    });

    describe('Modal Popouts', () => {
        it('MM-EXT-GL009 should open channel info as modal', () => {
            cy.get('#channelHeaderInfo').click();
            cy.get('.modal-popout').should('exist');
            cy.get('.modal-popout__title').should('contain', 'Channel Info');
        });

        it('MM-EXT-GL010 should close modal on backdrop click', () => {
            cy.get('#channelHeaderInfo').click();
            cy.get('.modal-popout__backdrop').click({force: true});
            cy.get('.modal-popout').should('not.exist');
        });

        it('MM-EXT-GL011 should close modal on escape key', () => {
            cy.get('#channelHeaderInfo').click();
            cy.get('body').type('{esc}');
            cy.get('.modal-popout').should('not.exist');
        });
    });

    describe('Mobile Fallback', () => {
        it('MM-EXT-GL012 should disable Guilded layout on mobile', () => {
            cy.viewport(375, 667); // iPhone SE
            cy.reload();
            cy.get('.guilded-team-sidebar').should('not.exist');
            // Should show stock Mattermost layout
            cy.get('#SidebarContainer').should('exist');
        });
    });

    describe('Enhanced Rows', () => {
        it('MM-EXT-GL013 should show message preview in channel rows', () => {
            // Post a message
            cy.postMessage('Test message preview');
            // Check sidebar row shows preview
            cy.get('.enhanced-channel-row__message').should('contain', 'Test message');
        });

        it('MM-EXT-GL014 should show typing indicator', () => {
            // Simulate typing in another session
            // Check typing indicator appears
        });
    });
});
```

**Step 2: Commit**

```bash
git add e2e-tests/cypress/tests/integration/channels/mattermost_extended/guilded_layout_spec.ts
git commit -m "test: add E2E tests for Guilded Chat Layout"
```

---

## Task 8: Final Integration Test

**Step 1: Enable feature flag**

Set environment variable:
```bash
MM_FEATUREFLAGS_GUILDEDCHATLAYOUT=true
```

**Step 2: Run through complete user flow**

Manual testing checklist:

**Initial Load:**
- [ ] Guilded layout renders on desktop
- [ ] Team sidebar shows DM button
- [ ] LHS shows enhanced channel rows
- [ ] RHS shows Members tab by default

**Team Sidebar:**
- [ ] DM button has correct styling
- [ ] Unread DM avatars appear when messages received
- [ ] Click expands to 240px overlay
- [ ] Click outside collapses overlay
- [ ] Favorited teams section works

**DM Mode:**
- [ ] Clicking DM button switches to DM list
- [ ] DM list shows all DMs with previews
- [ ] Search filters DMs correctly
- [ ] Back button returns to channels
- [ ] Clicking DM opens conversation
- [ ] RHS hides for 1:1 DMs
- [ ] RHS shows participants for Group DMs

**Persistent RHS:**
- [ ] Members tab shows grouped members (Admin/Member/Offline)
- [ ] Threads tab shows channel threads
- [ ] Tab switching works
- [ ] Member click opens profile popover
- [ ] Thread click navigates to thread

**Modal Popouts:**
- [ ] Info button opens channel info modal
- [ ] Pinned button opens pinned posts modal
- [ ] Files button opens files modal
- [ ] Search opens search modal
- [ ] All modals close on backdrop click
- [ ] All modals close on Escape key

**Sidebar Resize:**
- [ ] LHS can be resized
- [ ] RHS can be resized
- [ ] Widths persist on refresh
- [ ] Double-click resets to default

**Mobile:**
- [ ] Resize browser to < 768px
- [ ] Guilded layout disables
- [ ] Stock Mattermost layout appears
- [ ] Resize back to desktop
- [ ] Guilded layout re-enables

**Step 3: Fix any issues found**

```bash
git add -A
git commit -m "fix: address issues found in final integration testing"
```

---

## Task 9: Performance Audit

**Files:**
- Various

**Step 1: Check for unnecessary re-renders**

Use React DevTools Profiler to identify components re-rendering too often.

**Step 2: Memoize expensive computations**

Ensure selectors use `createSelector` for memoization:

```typescript
// Good
export const getChannelMembersGroupedByStatus = createSelector(
    'getChannelMembersGroupedByStatus',
    [...dependencies],
    (deps) => { /* expensive computation */ }
);
```

**Step 3: Virtualize long lists**

Ensure all lists with potentially many items use react-window:

- [ ] DM list - FixedSizeList
- [ ] Members list - VariableSizeList
- [ ] Threads list - FixedSizeList

**Step 4: Commit optimizations**

```bash
git add -A
git commit -m "perf: optimize Guilded layout component performance"
```

---

## Task 10: Final Cleanup

**Step 1: Remove console.log statements**

Search for and remove any debug logging:

```bash
grep -r "console.log" webapp/channels/src/components/guilded* --include="*.tsx" --include="*.ts"
```

**Step 2: Remove commented-out code**

**Step 3: Ensure all files have license headers**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
```

**Step 4: Run linter**

```bash
cd webapp && npm run lint
```

**Step 5: Fix any lint errors**

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup for Guilded Chat Layout"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Verify feature flag integration |
| 2 | Handle mode transitions |
| 3 | Handle mobile fallback |
| 4 | Add layout transition animations |
| 5 | Handle edge cases |
| 6 | Update CLAUDE.md documentation |
| 7 | Create E2E test specs |
| 8 | Final integration test |
| 9 | Performance audit |
| 10 | Final cleanup |

---

## Completion Checklist

Before marking complete:

- [ ] All subplans (01-07) completed
- [ ] Feature flag enables/disables correctly
- [ ] Mobile fallback works
- [ ] All manual tests pass
- [ ] E2E tests pass
- [ ] No lint errors
- [ ] Documentation updated
- [ ] Performance acceptable
- [ ] No console.log statements
- [ ] All files have license headers

**The Guilded Chat Layout feature is now complete!**
