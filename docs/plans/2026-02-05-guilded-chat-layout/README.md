# Guilded Chat Layout Implementation Plan

> **For Claude:** This is the master plan. Execute subplans in order using superpowers:executing-plans for each.

**Goal:** Transform Mattermost's UI into a Guilded-style layout with enhanced team sidebar, separate DM page, persistent member/threads list, and modal popouts for reference views.

**Architecture:** Single feature flag `GuildedChatLayout` controls all changes and auto-enables `ThreadsInSidebar`. Layout changes are desktop-only (disabled < 768px). The team sidebar gains DM access and expand/collapse functionality. LHS switches between channels and DMs with enhanced rich rows. RHS becomes a persistent Members/Threads tabbed panel. Reference views (pins, files, info, search) become modal popouts instead of RHS content.

**Tech Stack:** React, Redux, TypeScript, SCSS, styled-components, react-window (virtualization)

---

## Visual Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GUILDED CHAT LAYOUT                                │
├──────┬─────────────────────┬──────────────────────────┬─────────────────────┤
│      │                     │                          │                     │
│  T   │                     │                          │    PERSISTENT RHS   │
│  E   │   LHS SIDEBAR       │                          │                     │
│  A   │                     │                          │  ┌───────┬────────┐ │
│  M   │  ┌──────────────┐   │                          │  │Members│Threads │ │
│      │  │ ○ Channel 1  │   │                          │  └───────┴────────┘ │
│  S   │  │   Last msg...│   │     CENTER CHANNEL       │                     │
│  I   │  ├──────────────┤   │                          │  ┌─────────────────┐│
│  D   │  │ ○ Channel 2  │   │                          │  │ ● Admin (2)     ││
│  E   │  │   Preview... │   │                          │  │   @user1        ││
│  B   │  └──────────────┘   │                          │  │   @user2        ││
│  A   │                     │                          │  │ ● Member (5)    ││
│  R   │  [When DM mode:]    │                          │  │   @user3        ││
│      │  ┌──────────────┐   │                          │  │   ...           ││
│ ┌──┐ │  │ 👤 Username  │   │                          │  │ ● Offline (3)   ││
│ │DM│ │  │   Hey there! │   │                          │  │   @user6        ││
│ └──┘ │  │   2m ago  (3)│   │                          │  └─────────────────┘│
│ ─── │  └──────────────┘   │                          │                     │
│ FAV  │                     │                          │  [Hidden for 1:1   │
│ ─── │                     │                          │   DMs]             │
│ ALL  │                     │                          │                     │
└──────┴─────────────────────┴──────────────────────────┴─────────────────────┘

Modal Popouts (triggered from header buttons):
┌─────────────────────────────────────┐
│  ✕  Channel Info                    │
│─────────────────────────────────────│
│  Channel description, settings...   │
└─────────────────────────────────────┘
```

---

## Subplans

Execute in order. Each subplan is self-contained but may have dependencies on earlier ones.

| # | Subplan | Description | Dependencies |
|---|---------|-------------|--------------|
| 1 | [Feature Flag & Infrastructure](./01-feature-flag-and-infrastructure.md) | `GuildedChatLayout` flag, mobile detection, auto-enable logic | None |
| 2 | [Team Sidebar Enhancements](./02-team-sidebar-enhancements.md) | DM button, favorites, expand/collapse overlay | 01 |
| 3 | [Enhanced Conversation Rows](./03-enhanced-conversation-rows.md) | Rich rows with preview, timestamp, typing, unread | 01 |
| 4 | [DM Page](./04-dm-page.md) | DM list replacing LHS, routing, context switching | 01, 02, 03 |
| 5 | [Persistent RHS](./05-persistent-rhs.md) | Members/Threads tabs, hide for DMs, Discord-style grouping | 01 |
| 6 | [Modal Popouts](./06-modal-popouts.md) | Info, Pins, Files, Search, Edit History as modals | 01 |
| 7 | [Sidebar Resize Refactor](./07-sidebar-resize-refactor.md) | useResizable hook, inline styles, CSS cleanup | 01 |
| 8 | [Integration & Polish](./08-integration-and-polish.md) | Wire everything together, edge cases, final testing | All |

---

## Feature Flag Behavior

```
GuildedChatLayout = true
    │
    ├─► Auto-enables: ThreadsInSidebar = true
    │
    ├─► Desktop (≥768px): Full Guilded layout
    │
    └─► Mobile (<768px): Falls back to stock Mattermost
```

---

## Key Components Created

| Component | Location | Purpose |
|-----------|----------|---------|
| `GuildedTeamSidebar` | `components/guilded_team_sidebar/` | Enhanced team sidebar with DM button, favorites, expand |
| `EnhancedChannelRow` | `components/enhanced_channel_row/` | Rich row with preview, timestamp, typing, unread |
| `EnhancedDmRow` | `components/enhanced_dm_row/` | Rich DM row with avatar, status, preview |
| `DmListPage` | `components/dm_list_page/` | DM list that replaces LHS |
| `PersistentRhs` | `components/persistent_rhs/` | Members/Threads tabbed panel |
| `RhsThreadsList` | `components/rhs_threads_list/` | Thread list for RHS tab |
| `ModalPopout` | `components/modal_popout/` | Generic modal wrapper |
| `ChannelInfoModal` | `components/channel_info_modal/` | Channel info as modal |
| `PinnedPostsModal` | `components/pinned_posts_modal/` | Pinned posts as modal |
| `ChannelFilesModal` | `components/channel_files_modal/` | Files as modal |
| `SearchResultsModal` | `components/search_results_modal/` | Search as modal |
| `useResizable` | `components/resizable_sidebar/use_resizable.ts` | Unified resize hook |
| `ResizableSidebar` | `components/resizable_sidebar/resizable_sidebar.tsx` | Wrapper component |

---

## Redux State Additions

```typescript
// views/guilded_layout
interface GuildedLayoutState {
    // Team sidebar
    isTeamSidebarExpanded: boolean;
    favoritedTeamIds: string[];

    // DM mode
    isDmMode: boolean;

    // RHS tabs
    rhsActiveTab: 'members' | 'threads';

    // Modal states
    activeModal: 'info' | 'pins' | 'files' | 'search' | 'edit_history' | null;
    modalData: Record<string, unknown>;
}
```

---

## Migration Notes

- Existing `ThreadsInSidebar` users: No change, just auto-enabled
- Existing sidebar width preferences: Preserved, resize refactor maintains compatibility
- Existing RHS state: Falls back gracefully when Guilded layout disabled

---

## Test-Driven Development (TDD) Workflow

**CRITICAL: Tests MUST be written BEFORE implementation.**

Since tests cannot be run locally (requires Linux/Docker/PostgreSQL via GitHub Actions), follow this workflow:

### TDD Cycle for Each Feature

```
1. Write Test(s) → 2. Push to GitHub → 3. Verify Tests Fail → 4. Write Implementation → 5. Push Again → 6. Verify Tests Pass → 7. Commit
```

### Detailed Steps

1. **Write the failing test first**
   - Create test file in appropriate location
   - Test should define expected behavior
   - Use mocks/stubs for dependencies not yet created

2. **Push to GitHub and verify failure**
   - Push branch to GitHub
   - GitHub Actions runs tests via `test.yml`
   - Confirm tests fail with expected error (e.g., "module not found", "function undefined")

3. **Write minimal implementation**
   - Only write code to make tests pass
   - No extra features or "improvements"

4. **Push and verify tests pass**
   - Push implementation
   - Confirm all tests pass in GitHub Actions

5. **Commit with meaningful message**

### Test Locations

| Test Type | Location | Pattern |
|-----------|----------|---------|
| Component tests | `webapp/channels/src/components/<name>/__tests__/` | `*.test.tsx` |
| Selector tests | `webapp/channels/src/selectors/__tests__/` | `*.test.ts` |
| Reducer tests | `webapp/channels/src/reducers/__tests__/` | `*.test.ts` |
| Action tests | `webapp/channels/src/actions/__tests__/` | `*.test.ts` |
| Hook tests | `webapp/channels/src/hooks/__tests__/` | `*.test.ts` |

### Test File Structure

```typescript
// Example: components/guilded_team_sidebar/__tests__/index.test.tsx
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import GuildedTeamSidebar from '../index';

const mockStore = configureStore([]);

describe('GuildedTeamSidebar', () => {
    it('renders collapsed view by default', () => {
        const store = mockStore({
            views: {
                guildedLayout: {
                    isTeamSidebarExpanded: false,
                    isDmMode: false,
                },
            },
        });

        render(
            <Provider store={store}>
                <GuildedTeamSidebar />
            </Provider>
        );

        expect(screen.getByClassName('guilded-team-sidebar__collapsed')).toBeInTheDocument();
    });
});
```

### Running Tests

**Via GitHub Actions (required):**
```bash
# Push your branch
git push origin feature/guilded-layout

# Go to GitHub Actions → "Custom Tests" workflow
# Or tests run automatically on release tags
```

**Test Coverage Requirements:**
- All new components must have tests
- All new selectors must have tests
- All new reducers must have tests
- All new hooks must have tests

---

## Manual Testing Checklist (After TDD)

- [ ] Enable flag, verify full layout change
- [ ] Disable flag, verify stock layout
- [ ] Resize browser to mobile, verify fallback
- [ ] All modal popouts open/close correctly
- [ ] DM notifications show avatar in team sidebar
- [ ] Sidebar resize persists across refresh

---

## Estimated Scope

| Subplan | New Files | Modified Files | Complexity |
|---------|-----------|----------------|------------|
| 01 - Feature Flag | 2 | 4 | Low |
| 02 - Team Sidebar | 6 | 3 | Medium |
| 03 - Enhanced Rows | 4 | 2 | Medium |
| 04 - DM Page | 5 | 4 | High |
| 05 - Persistent RHS | 6 | 3 | Medium |
| 06 - Modal Popouts | 8 | 5 | Medium |
| 07 - Sidebar Resize | 4 | 4 | Medium |
| 08 - Integration | 1 | 6 | High |

**Total: ~36 new files, ~31 modified files**

---

## Getting Started

1. Read this README fully
2. Start with [01-feature-flag-and-infrastructure.md](./01-feature-flag-and-infrastructure.md)
3. Execute each subplan in order
4. Run integration tests after completing all subplans
