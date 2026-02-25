# PR #35118 Review Feedback — Summary & Remaining Work

## Context

PR review comments from **hmhealey**, **jgheithcock**, and **asaadmahmood** on PR #35118 (bookmarks overflow DnD with pragmatic-drag-and-drop). This document tracks what was addressed and what remains.

---

## Completed (committed)

### Code quality fixes
| # | Change | Files |
|---|---|---|
| 1 | Derive `isDragging` from `activeId` — removed redundant state | `use_bookmarks_dnd.ts` |
| 2 | Extract `BAR_INLINE_PADDING` / `ITEM_GAP` constants for magic numbers | `use_bookmarks_overflow.ts` |
| 3 | `Math.max(0, ...)` safeguard on overflow-trigger drop index | `use_bookmarks_dnd.ts` |
| 4 | Use `data-bookmark-id` attribute for querySelector instead of `data-testid` | `use_keyboard_reorder.ts`, `bookmarks_bar_item.tsx`, `overflow_bookmark_item.tsx` |
| 5 | Remove incorrect `aria-roledescription="sortable"` | `use_keyboard_reorder.ts`, `bookmark_item_content.tsx` |
| 6 | Add `setAutoOpenOverflow` to monitor `useEffect` deps | `use_bookmarks_dnd.ts` |
| 8 | Replace `@atlaskit/pragmatic-drag-and-drop-live-region` `announce` with existing `useReadout` hook | `use_keyboard_reorder.ts` |
| 9 | Overflow item: CSS classes (`is-dragging-self`, `is-keyboard-reordering`) instead of DOM style manipulation | `overflow_bookmark_item.tsx`, `channel_bookmarks.scss` |
| 10 | Remove empty `handleOverflowOpenChange` noop callback | `channel_bookmarks.tsx` |
| 11 | Remove always-true `hasLink` conditional (`ChannelBookmarkType` is only `'link' | 'file'`) | `bookmark_item_content.tsx` |
| 12 | Default `href` to `'#'` instead of `undefined` when links disabled | `bookmark_item_content.tsx` |

### Styling fixes
| # | Change | Files |
|---|---|---|
| 14 | Left-align overflow menu popup to match plus menu positioning | `bookmarks_bar_menu.tsx` |
| 15 | Fix overflow item label vertical clipping with `line-height: 20px` | `channel_bookmarks.scss` |

### Extractions / refactors
| # | Change | Files |
|---|---|---|
| 16 | Extract overflow detection logic into `useBookmarksOverflow` hook | `use_bookmarks_overflow.ts` (new), `channel_bookmarks.tsx` |
| 17 | Extract shared DnD logic into `useBookmarkDragDrop` hook | `use_bookmark_drag_drop.ts` (new), `bookmarks_bar_item.tsx`, `overflow_bookmark_item.tsx` |
| 18 | Move drag preview inline styles to CSS class (`.bookmarkDragPreview`) | `drag_preview.ts`, `channel_bookmarks.scss` |

---

## Skipped / Reverted

| # | Change | Reason |
|---|---|---|
| 7 | `useTextOverflow` callback ref pattern | Caused runtime error — needs investigation |
| 13 | `:focus-within` → `:has(:focus-visible)` for dot menu visibility | Reverted — approach wasn't right, needs revisiting |

---

## Remaining Work

### Accessibility (PR TODOs)
- [ ] **Fix cross-container transitions during keyboard reordering** — moving items between bar and overflow via keyboard has edge cases
- [ ] **Fix overflow bookmark item dotmenu keyboard access** — when item focused, `Right` arrow should open dot menu
- [ ] **Keyboard reordering in overflow menu** — `Space` to select, `Up`/`Down` to move, `Enter`/`Esc` to confirm/cancel within overflow
- [ ] **Keyboard reordering: close/confirm on click-away or focus-blur** — currently reorder state persists if user clicks elsewhere
- [ ] **Fix anchor/links in overflow menu** — semantic anchor UX: proper native `Copy Link Address`, `Open Link in New Tab`, etc. Redesign `useBookmarkLink().openBookmark` to reduce complexity

### Styling (PR TODOs)
- [ ] **Refine overflow item focus/hover/menu-open styling** — step 13 (focus-visible) was reverted; needs alternative approach to prevent dot menu showing on programmatic focus from MUI `autoFocusItem`
- [ ] **Fix plus menu label padding/menu width** — alignment fixed (step 14), but padding and width still need adjustment
- [ ] **Add ellipsis to drag-ghost overflowing text** — drag preview chip should truncate long names
- [ ] **`grabbing` cursor instead of `copy` when dragging** — pragmatic-dnd defaults to copy cursor

### Technical/patterns (PR TODOs)
- [ ] **`useTextOverflow` callback ref** — step 7 reverted; debug runtime error and re-apply
- [ ] **Sentinel ref `<li>` detection** — shared DnD hook extracted (step 17), but overflow items still use sentinel ref + `.closest('li')` to find MUI's rendered `<li>`. Explore function ref or alternative
- [ ] **`BookmarkMeasureItem` replacement** — currently uses hidden components to measure widths. Consider IntersectionObserver or measuring real items
- [ ] **Menu.tsx `hideBackdrop` → key handler** — hmhealey suggested replacing the `hideBackdrop` prop with a proper key/event handler approach (medium-term)

### Deferred reviewer comments (design questions)
- [ ] **Keep overflow open during drag** — hmhealey asked about overflow menu behavior when dragging over it. Needs design input
- [ ] **Auto-close overflow behavior** — when/how should overflow menu auto-close after drag operations
- [ ] **`openBookmark` code smell** — hmhealey noted the imperative navigation approach; relates to anchor/links TODO above

### Separate fix (not part of this PR)
- [ ] **`ScheduledPostIndicator` selector memoization** — `showChannelOrThreadScheduledPostIndicator` returns a new object every call. Convert to `createSelector` to prevent unnecessary rerenders
