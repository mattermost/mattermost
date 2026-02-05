# 01 - Feature Flag & Infrastructure

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `GuildedChatLayout` feature flag that auto-enables `ThreadsInSidebar` and provides mobile detection infrastructure.

**Architecture:** Feature flag in Go struct, exposed to client config. React hook for detecting Guilded mode that checks both the flag and viewport width. Auto-enable logic runs on app initialization.

**Tech Stack:** Go, TypeScript, React hooks

---

## Task 1: Add Feature Flag to Server

**Files:**
- Modify: `server/public/model/feature_flags.go`

**Step 1: Add feature flag to FeatureFlags struct**

Find the FeatureFlags struct (around line 130) and add after the last custom flag:

```go
	// Enable Guilded-style chat layout with enhanced team sidebar, DM page, and persistent RHS
	GuildedChatLayout bool
```

**Step 2: Commit**

```bash
git add server/public/model/feature_flags.go
git commit -m "feat: add GuildedChatLayout feature flag"
```

---

## Task 2: Add Feature Flag to Admin Console

**Files:**
- Modify: `webapp/channels/src/components/admin_console/mattermost_extended_features.tsx`
- Modify: `webapp/channels/src/components/admin_console/feature_flags.tsx`

**Step 1: Add to MATTERMOST_EXTENDED_FLAGS array**

In `mattermost_extended_features.tsx`, add to the `MATTERMOST_EXTENDED_FLAGS` array:

```typescript
'GuildedChatLayout',
```

**Step 2: Add metadata**

In `feature_flags.tsx`, add to the `FLAG_METADATA` object:

```typescript
GuildedChatLayout: {
    description: 'Guilded-style layout: enhanced team sidebar with DM button, separate DM page, persistent Members/Threads RHS, and modal popouts. Auto-enables ThreadsInSidebar. Desktop only.',
    defaultValue: false,
},
```

**Step 3: Commit**

```bash
git add webapp/channels/src/components/admin_console/mattermost_extended_features.tsx
git add webapp/channels/src/components/admin_console/feature_flags.tsx
git commit -m "feat: add GuildedChatLayout to admin console"
```

---

## Task 3: Create useGuildedLayout Hook

**Files:**
- Create: `webapp/channels/src/hooks/use_guilded_layout.ts`

**Step 1: Create the hook**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

const MOBILE_BREAKPOINT = 768;

/**
 * Hook to determine if Guilded layout is active.
 * Returns true only if:
 * 1. GuildedChatLayout feature flag is enabled
 * 2. Viewport width is >= 768px (desktop)
 */
export function useGuildedLayout(): boolean {
    const config = useSelector(getConfig);
    const isFeatureEnabled = config.FeatureFlagGuildedChatLayout === 'true';

    const [isDesktop, setIsDesktop] = useState(() => {
        if (typeof window === 'undefined') {
            return true;
        }
        return window.innerWidth >= MOBILE_BREAKPOINT;
    });

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleResize = () => {
            setIsDesktop(window.innerWidth >= MOBILE_BREAKPOINT);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isFeatureEnabled && isDesktop;
}

/**
 * Hook to get just the feature flag state (ignoring viewport).
 * Useful for checking if the feature is configured, even on mobile.
 */
export function useGuildedLayoutEnabled(): boolean {
    const config = useSelector(getConfig);
    return config.FeatureFlagGuildedChatLayout === 'true';
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/hooks/use_guilded_layout.ts
git commit -m "feat: add useGuildedLayout hook with mobile detection"
```

---

## Task 4: Create Auto-Enable Logic for ThreadsInSidebar

**Files:**
- Modify: `webapp/channels/src/actions/views/root.ts` (or appropriate initialization file)

**Step 1: Find the app initialization logic**

Look for where feature flags are processed on app load. This is typically in the root actions or a dedicated feature flag processor.

**Step 2: Add auto-enable logic**

Create a new action or modify existing initialization:

```typescript
// In the appropriate initialization file, add:

import {getConfig} from 'mattermost-redux/selectors/entities/general';

export function processGuildedLayoutDependencies() {
    return (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const state = getState();
        const config = getConfig(state);

        // GuildedChatLayout auto-enables ThreadsInSidebar
        if (config.FeatureFlagGuildedChatLayout === 'true') {
            // ThreadsInSidebar behavior is automatically active when GuildedChatLayout is on
            // This is handled at the component level - no runtime config change needed
            // The feature flag check will use: isGuildedLayout || isThreadsInSidebarEnabled
            console.log('[GuildedChatLayout] Active - ThreadsInSidebar behavior enabled');
        }

        return {data: true};
    };
}
```

**Note:** The actual "auto-enable" happens at the component level by checking `isGuildedLayout || config.FeatureFlagThreadsInSidebar === 'true'` wherever ThreadsInSidebar behavior is used.

**Step 3: Commit**

```bash
git add webapp/channels/src/actions/views/root.ts
git commit -m "feat: add GuildedChatLayout dependency processing"
```

---

## Task 5: Create Shared Selector for Threads-in-Sidebar Behavior

**Files:**
- Create: `webapp/channels/src/selectors/views/guilded_layout.ts`

**Step 1: Create the selector file**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

/**
 * Returns true if ThreadsInSidebar behavior should be active.
 * This is true if either:
 * - ThreadsInSidebar feature flag is enabled, OR
 * - GuildedChatLayout feature flag is enabled (auto-enables ThreadsInSidebar)
 */
export const isThreadsInSidebarActive = createSelector(
    'isThreadsInSidebarActive',
    getConfig,
    (config): boolean => {
        return (
            config.FeatureFlagThreadsInSidebar === 'true' ||
            config.FeatureFlagGuildedChatLayout === 'true'
        );
    },
);

/**
 * Returns true if the full Guilded layout is enabled (feature flag only, ignores viewport).
 */
export const isGuildedLayoutEnabled = createSelector(
    'isGuildedLayoutEnabled',
    getConfig,
    (config): boolean => {
        return config.FeatureFlagGuildedChatLayout === 'true';
    },
);

/**
 * Returns the mobile breakpoint for Guilded layout.
 */
export const GUILDED_MOBILE_BREAKPOINT = 768;
```

**Step 2: Commit**

```bash
git add webapp/channels/src/selectors/views/guilded_layout.ts
git commit -m "feat: add Guilded layout selectors"
```

---

## Task 6: Update Existing ThreadsInSidebar Checks

**Files:**
- Search and update all files that check `FeatureFlagThreadsInSidebar`

**Step 1: Find all usages**

```bash
grep -r "FeatureFlagThreadsInSidebar" webapp/channels/src --include="*.ts" --include="*.tsx"
```

**Step 2: Update each file to use the new selector**

Replace direct config checks:

```typescript
// BEFORE:
const config = getConfig(state);
const isThreadsInSidebar = config.FeatureFlagThreadsInSidebar === 'true';

// AFTER:
import {isThreadsInSidebarActive} from 'selectors/views/guilded_layout';
const isThreadsInSidebar = isThreadsInSidebarActive(state);
```

**Step 3: Commit**

```bash
git add -A
git commit -m "refactor: use isThreadsInSidebarActive selector for GuildedChatLayout compatibility"
```

---

## Task 7: Add Redux State for Guilded Layout

**Files:**
- Create: `webapp/channels/src/reducers/views/guilded_layout.ts`
- Modify: `webapp/channels/src/reducers/views/index.ts`

**Step 1: Create the reducer**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

// Team sidebar expanded state
function isTeamSidebarExpanded(state = false, action: MMAction): boolean {
    switch (action.type) {
    case ActionTypes.GUILDED_TOGGLE_TEAM_SIDEBAR:
        return !state;
    case ActionTypes.GUILDED_SET_TEAM_SIDEBAR_EXPANDED:
        return action.expanded;
    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

// DM mode (showing DM list instead of channels)
function isDmMode(state = false, action: MMAction): boolean {
    switch (action.type) {
    case ActionTypes.GUILDED_SET_DM_MODE:
        return action.isDmMode;
    case ActionTypes.GUILDED_TOGGLE_DM_MODE:
        return !state;
    case UserTypes.LOGOUT_SUCCESS:
        return false;
    default:
        return state;
    }
}

// RHS active tab
function rhsActiveTab(state: 'members' | 'threads' = 'members', action: MMAction): 'members' | 'threads' {
    switch (action.type) {
    case ActionTypes.GUILDED_SET_RHS_TAB:
        return action.tab;
    case UserTypes.LOGOUT_SUCCESS:
        return 'members';
    default:
        return state;
    }
}

// Active modal
type ModalType = 'info' | 'pins' | 'files' | 'search' | 'edit_history' | null;

function activeModal(state: ModalType = null, action: MMAction): ModalType {
    switch (action.type) {
    case ActionTypes.GUILDED_OPEN_MODAL:
        return action.modalType;
    case ActionTypes.GUILDED_CLOSE_MODAL:
        return null;
    case UserTypes.LOGOUT_SUCCESS:
        return null;
    default:
        return state;
    }
}

// Modal data (e.g., channel ID for channel info modal)
function modalData(state: Record<string, unknown> = {}, action: MMAction): Record<string, unknown> {
    switch (action.type) {
    case ActionTypes.GUILDED_OPEN_MODAL:
        return action.data || {};
    case ActionTypes.GUILDED_CLOSE_MODAL:
        return {};
    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

export default combineReducers({
    isTeamSidebarExpanded,
    isDmMode,
    rhsActiveTab,
    activeModal,
    modalData,
});
```

**Step 2: Add to views reducer index**

In `webapp/channels/src/reducers/views/index.ts`, add:

```typescript
import guildedLayout from './guilded_layout';

// In the combineReducers call:
guildedLayout,
```

**Step 3: Commit**

```bash
git add webapp/channels/src/reducers/views/guilded_layout.ts
git add webapp/channels/src/reducers/views/index.ts
git commit -m "feat: add Redux state for Guilded layout"
```

---

## Task 8: Add Action Types

**Files:**
- Modify: `webapp/channels/src/utils/constants.tsx`

**Step 1: Add action types to ActionTypes object**

Find the `ActionTypes` object and add:

```typescript
// Guilded Layout
GUILDED_TOGGLE_TEAM_SIDEBAR: null,
GUILDED_SET_TEAM_SIDEBAR_EXPANDED: null,
GUILDED_SET_DM_MODE: null,
GUILDED_TOGGLE_DM_MODE: null,
GUILDED_SET_RHS_TAB: null,
GUILDED_OPEN_MODAL: null,
GUILDED_CLOSE_MODAL: null,
```

**Step 2: Commit**

```bash
git add webapp/channels/src/utils/constants.tsx
git commit -m "feat: add Guilded layout action types"
```

---

## Task 9: Create Guilded Layout Actions

**Files:**
- Create: `webapp/channels/src/actions/views/guilded_layout.ts`

**Step 1: Create actions file**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ActionTypes} from 'utils/constants';

export function toggleTeamSidebarExpanded() {
    return {
        type: ActionTypes.GUILDED_TOGGLE_TEAM_SIDEBAR,
    };
}

export function setTeamSidebarExpanded(expanded: boolean) {
    return {
        type: ActionTypes.GUILDED_SET_TEAM_SIDEBAR_EXPANDED,
        expanded,
    };
}

export function setDmMode(isDmMode: boolean) {
    return {
        type: ActionTypes.GUILDED_SET_DM_MODE,
        isDmMode,
    };
}

export function toggleDmMode() {
    return {
        type: ActionTypes.GUILDED_TOGGLE_DM_MODE,
    };
}

export function setRhsTab(tab: 'members' | 'threads') {
    return {
        type: ActionTypes.GUILDED_SET_RHS_TAB,
        tab,
    };
}

export type GuildedModalType = 'info' | 'pins' | 'files' | 'search' | 'edit_history';

export function openGuildedModal(modalType: GuildedModalType, data?: Record<string, unknown>) {
    return {
        type: ActionTypes.GUILDED_OPEN_MODAL,
        modalType,
        data,
    };
}

export function closeGuildedModal() {
    return {
        type: ActionTypes.GUILDED_CLOSE_MODAL,
    };
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/actions/views/guilded_layout.ts
git commit -m "feat: add Guilded layout action creators"
```

---

## Task 10: Add Type Definitions

**Files:**
- Modify: `webapp/channels/src/types/store/index.ts` (or appropriate types file)

**Step 1: Add GuildedLayoutState type**

```typescript
export interface GuildedLayoutState {
    isTeamSidebarExpanded: boolean;
    isDmMode: boolean;
    rhsActiveTab: 'members' | 'threads';
    activeModal: 'info' | 'pins' | 'files' | 'search' | 'edit_history' | null;
    modalData: Record<string, unknown>;
}
```

**Step 2: Add to GlobalState views**

Ensure the views state includes:

```typescript
interface ViewsState {
    // ... existing ...
    guildedLayout: GuildedLayoutState;
}
```

**Step 3: Commit**

```bash
git add webapp/channels/src/types/store/index.ts
git commit -m "feat: add GuildedLayoutState type definitions"
```

---

## Task 11: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Add to Current Feature Flags table**

```markdown
| `GuildedChatLayout` | Guilded-style layout with enhanced team sidebar, DM page, persistent RHS | `MM_FEATUREFLAGS_GUILDEDCHATLAYOUT=true` |
```

**Step 2: Add to Current Customizations table**

```markdown
| Guilded Chat Layout | Flag | Guilded-style UI: enhanced team sidebar with DM button, separate DM page, persistent Members/Threads RHS, modal popouts. Auto-enables ThreadsInSidebar. Desktop only. |
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add GuildedChatLayout to CLAUDE.md"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | feature_flags.go | Add server-side flag |
| 2 | admin console | Add to admin UI |
| 3 | use_guilded_layout.ts | Create hook with mobile detection |
| 4 | root.ts | Add auto-enable logic |
| 5 | guilded_layout.ts (selectors) | Create shared selectors |
| 6 | Various | Update ThreadsInSidebar checks |
| 7 | guilded_layout.ts (reducer) | Create Redux reducer |
| 8 | constants.tsx | Add action types |
| 9 | guilded_layout.ts (actions) | Create action creators |
| 10 | types | Add type definitions |
| 11 | CLAUDE.md | Update documentation |

**Next:** [02-team-sidebar-enhancements.md](./02-team-sidebar-enhancements.md)
