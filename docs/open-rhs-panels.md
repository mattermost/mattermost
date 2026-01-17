# Open RHS Panels - POC Plan

> New tab-like UX flows supercharge RHS with increased contextual clarity and easier access to threads, searches, and other RHS panels.

## Overview

Transform the RHS (Right Hand Side) from a single-panel system into a multi-panel tabbed experience where users can have multiple threads, searches, and other panels "open" simultaneously, represented as icons in the AppBar.

---

## UX Requirements

1. **AppBar Icons for Open Panels**: When opening an RHS panel, a new AppBar icon becomes visible representing that thread, search, etc.

2. **Persistent Icons**: AppBar icons representing RHS panels only close when the RHS panel X/Close button is pressed (not on minimize or panel switch).

3. **Minimize Button**: Add a minimize button to RHS panel headers. Order: `[Minimize] [Maximize] [Close]`
   - Minimize hides the RHS panel but keeps the AppBar icon visible
   - The panel state is preserved

4. **Restore from Minimized**: Clicking a minimized RHS panel's AppBar icon restores/opens that panel.

---

## State Architecture

### Current RHS State (`RhsViewState`)

```typescript
// From types/store/rhs.ts
export type RhsViewState = {
    // Panel-specific state (needs isolation per panel)
    selectedPostId: Post['id'];           // Thread root post
    selectedPostFocussedAt: number;       // Focus timestamp
    selectedPostCardId: Post['id'];       // Card view post
    selectedChannelId: Channel['id'];     // Channel context
    highlightedPostId: Post['id'];        // Highlighted post
    previousRhsStates: RhsState[];        // Back navigation stack
    rhsState: RhsState;                   // Panel type
    searchTerms: string;                  // Search query
    searchTeam: Team['id'] | null;        // Search team scope
    searchType: SearchType;               // 'files' | 'messages' | ''
    pluggableId: string;                  // Plugin ID
    searchResultsTerms: string;           // Display terms
    searchResultsType: string;            // Display type
    filesSearchExtFilter: string[];       // File filters

    // Global state (shared across panels)
    isSidebarOpen: boolean;               // RHS visibility
    isSidebarExpanded: boolean;           // Full-width mode
    isMenuOpen: boolean;                  // Menu state
    size: SidebarSize;                    // Width
    shouldFocusRHS: boolean;              // Focus flag
    isSearchingFlaggedPost: boolean;      // Loading states
    isSearchingPinnedPost: boolean;
    editChannelMembers: boolean;          // Edit mode
};
```

### Proposed New State Structure

```typescript
// New panel state type - isolated per panel
export type RhsPanelState = {
    id: string;                           // Unique panel ID (uuid)
    type: RhsPanelType;                   // 'thread' | 'search' | 'channel_info' | etc.

    // Core panel state
    selectedPostId: Post['id'];
    selectedPostFocussedAt: number;
    selectedPostCardId: Post['id'];
    selectedChannelId: Channel['id'];     // CRITICAL: isolates channel context
    highlightedPostId: Post['id'];
    previousRhsStates: RhsState[];
    rhsState: RhsState;

    // Search-specific state
    searchTerms: string;
    searchTeam: Team['id'] | null;
    searchType: SearchType;
    searchResultsTerms: string;
    searchResultsType: string;
    filesSearchExtFilter: string[];

    // Plugin-specific state
    pluggableId: string;

    // Panel metadata
    title: string;                        // Display title for AppBar tooltip
    iconType: string;                     // Icon to show in AppBar
    minimized: boolean;                   // Is panel minimized?
    createdAt: number;                    // For ordering
};

// Panel type enum
export type RhsPanelType =
    | 'thread'
    | 'search'
    | 'mention'
    | 'flag'
    | 'pin'
    | 'channel_files'
    | 'channel_info'
    | 'channel_members'
    | 'plugin'
    | 'edit_history';

// New top-level RHS state
export type RhsViewState = {
    // Multi-panel state
    panels: Record<string, RhsPanelState>;  // All open panels by ID
    activePanelId: string | null;           // Currently visible panel
    panelOrder: string[];                   // Order for AppBar icons

    // Global state (unchanged)
    isSidebarOpen: boolean;
    isSidebarExpanded: boolean;
    isMenuOpen: boolean;
    size: SidebarSize;
    shouldFocusRHS: boolean;
    isSearchingFlaggedPost: boolean;
    isSearchingPinnedPost: boolean;
    editChannelMembers: boolean;
};
```

### Why State Isolation Matters

1. **Threads from Other Channels**: When viewing a thread from a different channel, the panel needs its own `selectedChannelId` so selectors like `getSelectedChannel` return the correct channel for that panel, not `currentChannel`.

2. **Multiple Searches**: User might have a search for "bug" and another for "feature" - each needs its own `searchTerms`, `searchResultsTerms`.

3. **Back Navigation**: Each panel needs its own `previousRhsStates` stack.

4. **Plugin Panels**: Multiple plugin panels need their own `pluggableId`.

---

## Implementation Plan

### Phase 1: Foundation (POC Core)

#### 1.1 New Types
- [ ] Create `RhsPanelState` type in `types/store/rhs.ts`
- [ ] Create `RhsPanelType` enum
- [ ] Update `RhsViewState` with `panels`, `activePanelId`, `panelOrder`

#### 1.2 Redux Actions
- [ ] `openRhsPanel(panelState: Partial<RhsPanelState>)` - Create/open panel
- [ ] `closeRhsPanel(panelId: string)` - Remove panel entirely
- [ ] `minimizeRhsPanel(panelId: string)` - Set minimized=true, clear activePanelId
- [ ] `restoreRhsPanel(panelId: string)` - Set minimized=false, set activePanelId
- [ ] `setActivePanelId(panelId: string | null)` - Switch visible panel
- [ ] `updatePanelState(panelId: string, updates: Partial<RhsPanelState>)` - Update panel

#### 1.3 Redux Reducer
- [ ] Update `reducers/views/rhs.ts` to handle new panel actions
- [ ] Maintain backwards compatibility during transition

#### 1.4 Selectors
- [ ] `getOpenPanels(state)` - All panels
- [ ] `getActivePanelId(state)` - Current panel ID
- [ ] `getActivePanel(state)` - Current panel state
- [ ] `getPanelById(state, panelId)` - Specific panel
- [ ] `getMinimizedPanels(state)` - Panels in minimized state
- [ ] `getPanelOrder(state)` - Order for AppBar

### Phase 2: UI Components

#### 2.1 RHS Header Updates
- [ ] Add Minimize button to `RhsHeaderPost`
- [ ] Add Minimize button to `RhsCardHeader`
- [ ] Wire up minimize action
- [ ] Update button order: `[Minimize] [Maximize] [Close]`

#### 2.2 AppBar Panel Icons
- [ ] Create `AppBarRhsPanel` component
- [ ] Show icon based on panel type
- [ ] Show active state for current panel
- [ ] Show minimized state indicator
- [ ] Handle click to restore/switch panels
- [ ] Render in `AppBar` component

#### 2.3 SidebarRight Updates
- [ ] Read from `activePanel` state instead of flat RHS state
- [ ] Create panel context provider for isolated state access
- [ ] Update child components to use panel context

### Phase 3: Context Isolation

#### 3.1 Panel Context
- [ ] Create `RhsPanelContext` for providing panel-specific state
- [ ] Create `useRhsPanelState()` hook
- [ ] Create panel-scoped selectors: `getPanelSelectedChannel`, etc.

#### 3.2 Component Migration
- [ ] Update `RhsThread` to use panel context
- [ ] Update `Search` components to use panel context
- [ ] Update `ChannelInfoRhs` to use panel context
- [ ] Update other RHS components

---

## File Changes Summary

### New Files
```
webapp/channels/src/types/store/rhs_panel.ts       # New panel types
webapp/channels/src/components/app_bar/app_bar_rhs_panel.tsx  # AppBar icon component
webapp/channels/src/contexts/rhs_panel_context.tsx  # Panel context provider
webapp/channels/src/hooks/use_rhs_panel.ts          # Panel hooks
```

### Modified Files
```
webapp/channels/src/types/store/rhs.ts             # Update RhsViewState
webapp/channels/src/reducers/views/rhs.ts          # Add panel reducers
webapp/channels/src/actions/views/rhs.ts           # Add panel actions
webapp/channels/src/selectors/rhs.ts               # Add panel selectors
webapp/channels/src/components/rhs_header_post/    # Add minimize button
webapp/channels/src/components/rhs_card_header/    # Add minimize button
webapp/channels/src/components/app_bar/app_bar.tsx # Render panel icons
webapp/channels/src/components/sidebar_right/      # Use panel context
```

---

## AppBar Icon Mapping

| Panel Type | Icon | Tooltip |
|-----------|------|---------|
| thread | `message-text-outline` | "Thread: {channel_name}" |
| search | `magnify` | "Search: {search_terms}" |
| mention | `at` | "Mentions" |
| flag | `bookmark-outline` | "Saved Messages" |
| pin | `pin-outline` | "Pinned: {channel_name}" |
| channel_files | `file-multiple-outline` | "Files: {channel_name}" |
| channel_info | `information-outline` | "Info: {channel_name}" |
| channel_members | `account-multiple-outline` | "Members: {channel_name}" |
| plugin | `puzzle-outline` | "{plugin_name}" |

---

## Open Questions

1. **Panel Limit**: Should we limit the number of open panels? (e.g., max 10)

2. **Panel Ordering**: How should panels be ordered in AppBar?
   - Most recently used?
   - Creation order?
   - Alphabetically by type?

3. **Duplicate Detection**: If user opens same thread twice, should we:
   - Focus existing panel?
   - Open new duplicate panel?
   - Ask user?

4. **Persistence**: Should open panels persist across page refresh?
   - Requires localStorage/IndexedDB
   - Need to handle stale data (deleted posts, etc.)

5. **Mobile UX**: How does this work on mobile where AppBar may not be visible?

---

## POC Scope (Phase 1 Minimal)

For the initial POC, focus on:

1. **Thread panels only** - Most common use case
2. **Basic minimize/restore** - Core UX flow
3. **Simple AppBar icons** - Visual representation
4. **No persistence** - Panels lost on refresh
5. **Allow duplicates** - Simpler logic

This gets the core UX working quickly for validation before investing in full implementation.

---

## Testing Plan

### Unit Tests
- [ ] Panel reducer actions
- [ ] Panel selectors
- [ ] Panel context hooks

### Integration Tests
- [ ] Open panel from post
- [ ] Minimize panel
- [ ] Restore from AppBar
- [ ] Close panel
- [ ] Switch between panels

### Manual Testing
- [ ] Open thread from different channel
- [ ] Verify channel context is correct
- [ ] Test with multiple panels
- [ ] Test keyboard navigation

---

## Migration Strategy

1. **Feature Flag**: Add `OpenRhsPanels` feature flag
2. **Parallel State**: Keep old RHS state working alongside new panel state
3. **Gradual Rollout**: Enable for specific users/teams first
4. **Fallback**: Easy disable if issues arise

---

## Notes

_Implementation notes and decisions will be added here as work progresses._

### 2025-01-16
- Initial plan created
- Identified state isolation requirements
- Mapped out phase 1 POC scope

### 2025-01-16 - POC Implementation Complete

#### Files Created
- `types/store/rhs_panel.ts` - New panel types and helpers
- `components/app_bar/app_bar_rhs_panel/` - AppBar icon component for panels

#### Files Modified
- `types/store/rhs.ts` - Added `openPanels: RhsPanelsState` to RhsViewState
- `utils/constants.tsx` - Added panel action types
- `actions/views/rhs.ts` - Added panel actions + modified `selectPost` to create panels
- `reducers/views/rhs.ts` - Added `openPanels` reducer
- `selectors/rhs.ts` - Added panel selectors
- `components/rhs_header_post/` - Added minimize button
- `components/app_bar/app_bar.tsx` - Integrated panel icons

#### Key Implementation Details

1. **State Isolation**: Each panel has its own `selectedChannelId`, `selectedPostId`, etc.
   - Allows viewing threads from different channels
   - Panel state is independent of global RHS state

2. **Backwards Compatibility**: `selectPost` dispatches both:
   - Legacy `SELECT_POST` action (for existing RHS behavior)
   - New `OPEN_RHS_PANEL` action (for panel tracking)

3. **Minimize Flow**:
   - Click minimize → `minimizeRhsPanel(panelId)` → panel.minimized = true, activePanelId = null
   - Click AppBar icon → `restoreRhsPanel(panelId)` → panel.minimized = false, activePanelId = panelId

4. **Panel Lifecycle**:
   - Open thread → creates panel + sets active
   - Minimize → hides RHS, keeps icon in AppBar
   - Close (X button) → removes panel entirely

#### What's Working
- [x] Panels created when threads opened
- [x] Panel state tracked in Redux
- [x] Minimize button in RHS header
- [x] AppBar panel icons rendered
- [x] Click to restore/activate panels

#### Known Limitations (POC)
- No panel limit
- Only thread panels implemented (search, mentions, etc. not yet creating panels)
- No validation of stale posts on restore (deleted posts will show error in RHS)

### 2025-01-16 - Fixes Applied

1. **Minimize now closes RHS**: Added `MINIMIZE_RHS_PANEL` to `isSidebarOpen` reducer to set it to false
2. **Close button wired up**: RHS header Close button now calls `closeRhsPanel(activePanelId)` which removes the panel and its AppBar icon
3. **Toggle behavior on AppBar icons**:
   - Click minimized icon → restores panel
   - Click active icon → minimizes panel (toggle off)
   - Click non-active icon → activates that panel

### 2025-01-16 - UX Improvements

1. **Duplicate Detection**: Opening the same thread twice now reuses the existing panel instead of creating a duplicate. The `selectPost` action checks for existing panels with the same `selectedPostId` and restores that panel if found.

2. **Simplified Icon States**: AppBar panel icons now have only two visual states:
   - Active (with blue line indicator on left)
   - Minimized/inactive (without blue line)

3. **Legacy State Sync**: When restoring or activating a panel, the legacy `selectedPostId` is synced to ensure the RHS content matches the panel state.

4. **Alt+Click Quick Close**: Hold Alt key to show close buttons on all AppBar panel icons for efficient bulk closing:
   - When Alt is held, icons transform to red X buttons
   - Clicking closes the panel immediately
   - Useful for quickly cleaning up multiple open panels
   - Window blur resets the Alt state to prevent stuck state

5. **Persistence Across Page Refresh**: Panel state now persists via `useGlobalState` hook:
   - Uses the storage reducer (persisted to IndexedDB via localForage)
   - Scoped to user only (not team) so panels persist across team switches
   - Stores minimal panel data: `id`, `type`, `selectedPostId`, `selectedChannelId`, `title`, `minimized`, `createdAt`
   - On restore, all panels open as minimized (to avoid jarring UX)
   - Initial restore only happens if Redux has no panels (fresh page load)
   - Storage key: `rhs_open_panels:{userId}`
