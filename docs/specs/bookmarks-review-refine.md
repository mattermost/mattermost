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
| 14 | Right-align overflow menu popup (right-edge anchored to trigger button) | `bookmarks_bar_menu.tsx` |
| 15 | Fix overflow item label vertical clipping with `line-height: 20px` | `channel_bookmarks.scss` |
| — | Fix drag preview text truncation (`inline-block` so `text-overflow: ellipsis` works) | `channel_bookmarks.scss` |
| — | Drag cursor: `effectAllowed='move'` + `preventUnhandled` for consistent `cursor:default` during drag (native DnD limitation prevents `cursor:grabbing`) | `use_bookmark_drag_drop.ts` |
| — | Bar item `:focus-visible` indicator matching standard `a11y--focused` style | `bookmark_item_content.tsx` |
| — | Overflow item `.Mui-focusVisible` for trailing-elements visibility (replaces `:focus-within` to fix dot menu showing on programmatic focus) | `channel_bookmarks.scss` |
| — | Keyboard-reorder outline thickened to 3px (vs 2px focus indicator) on bar + overflow items | `bookmarks_bar_item.tsx`, `channel_bookmarks.scss` |

### Extractions / refactors
| # | Change | Files |
|---|---|---|
| 16 | Extract overflow detection logic into `useBookmarksOverflow` hook | `use_bookmarks_overflow.ts` (new), `channel_bookmarks.tsx` |
| 17 | Extract shared DnD logic into `useBookmarkDragDrop` hook | `use_bookmark_drag_drop.ts` (new), `bookmarks_bar_item.tsx`, `overflow_bookmark_item.tsx` |
| 18 | Move drag preview inline styles to CSS class (`.bookmarkDragPreview`) | `drag_preview.ts`, `channel_bookmarks.scss` |
| — | Add `forwardRef` to `Menu.Item` — eliminates sentinel ref + `.closest('li')` hack | `menu_item.tsx`, `overflow_bookmark_item.tsx` |

### Keyboard accessibility
| Change | Files |
|---|---|
| Wire `getItemProps` (tabIndex + onKeyDown) to overflow items for keyboard reorder support | `bookmarks_bar_menu.tsx`, `overflow_bookmark_item.tsx`, `channel_bookmarks.tsx` |
| Direction-aware arrow keys: bar items use Left/Right, overflow items use Up/Down — switches on cross-container moves | `use_keyboard_reorder.ts` |
| Force-open overflow menu on bar→overflow keyboard transition; close on overflow→bar | `channel_bookmarks.tsx`, `use_keyboard_reorder.ts` |
| Fix `forceOpen` to emit `false` (not `undefined`) so Menu's `isMenuOpen` effect properly closes the menu | `channel_bookmarks.tsx` |
| Add `disableRestoreFocus` prop to `Menu.tsx`, prevent MUI stealing focus during keyboard reorder | `menu.tsx`, `bookmarks_bar_menu.tsx` |
| Fix focus fallback for overflow items (fall back to `<li>` element itself when no inner `a[tabindex]` found) | `use_keyboard_reorder.ts` |
| Confirm reorder placement on click-anywhere via new `useClickOutside` hook | `useClickOutside.ts` (new), `use_keyboard_reorder.ts` |
| Remove `[key: string]: unknown` index signature from overflow item props in favor of typed `keyboardReorderProps` | `overflow_bookmark_item.tsx` |
| Anchor overflow dropdown right-edge to right-edge of trigger button | `bookmarks_bar_menu.tsx` |
| Add `autoFocusItem` option to `Menu.tsx`; overflow menu disables it so no item is auto-focused on open — ArrowDown from Popover container focuses first item, then MUI handles cycling | `menu.tsx`, `bookmarks_bar_menu.tsx` |
| Block all conflicting keys during keyboard reorder (Tab, Shift+Tab, Home, End, letter keys, etc.) — only reorder controls allowed | `use_keyboard_reorder.ts` |

---

## Skipped / Reverted

| # | Change | Reason |
|---|---|---|
| 7 | `useTextOverflow` callback ref pattern | Caused runtime error — needs investigation |
| 13 | `:focus-within` → `:has(:focus-visible)` for bar item dot menu | Reverted — replaced with `.Mui-focusVisible` approach for overflow items only (see styling fixes above) |

---

## Remaining Work

### Accessibility (PR TODOs)
- [ ] **Fix overflow bookmark item dotmenu keyboard access** — when item focused, `Right` arrow should open dot menu
- [ ] **Fix anchor/links in overflow menu** — semantic anchor UX: proper native `Copy Link Address`, `Open Link in New Tab`, etc. Redesign `useBookmarkLink().openBookmark` to reduce complexity

### Styling (PR TODOs)
- [ ] **Fix plus menu label padding/menu width** — alignment fixed (step 14), but padding and width still need adjustment

### Technical/patterns (PR TODOs)
- [ ] **`useTextOverflow` callback ref** — step 7 reverted; debug runtime error and re-apply
- [ ] **`BookmarkMeasureItem` replacement** — currently uses hidden components to measure widths. Consider IntersectionObserver or measuring real items
- [ ] **Menu.tsx `hideBackdrop` → key handler** — hmhealey suggested replacing the `hideBackdrop` prop with a proper key/event handler approach (medium-term)

### Potential enhancements
- [ ] **Register bookmarks bar as A11yController region** — add `a11y__region` class + `data-a11y-sort-order` (between channel header 8 and search bar 9) so F6/Ctrl+` focus cycling includes the bookmarks bar. Individual bookmarks would be `a11y__section` children.

### Deferred reviewer comments (design questions)
- [ ] **Keep overflow open during drag** — hmhealey asked about overflow menu behavior when dragging over it. Needs design input
- [ ] **Auto-close overflow behavior** — when/how should overflow menu auto-close after drag operations
- [ ] **`openBookmark` code smell** — hmhealey noted the imperative navigation approach; relates to anchor/links TODO above

### Separate fix (not part of this PR)
- [ ] **`ScheduledPostIndicator` selector memoization** — `showChannelOrThreadScheduledPostIndicator` returns a new object every call. Convert to `createSelector` to prevent unnecessary rerenders
