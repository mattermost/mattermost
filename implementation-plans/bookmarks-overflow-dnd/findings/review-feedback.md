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
| Change | Files |
|---|---|
| Right-align overflow menu popup (right-edge anchored to trigger button) | `bookmarks_bar_menu.tsx` |
| Fix overflow item label vertical clipping with `line-height: 20px` | `channel_bookmarks.scss` |
| Fix drag preview text truncation (`inline-block` so `text-overflow: ellipsis` works) | `channel_bookmarks.scss` |
| Drag cursor: `effectAllowed='move'` + `preventUnhandled` for consistent `cursor:default` during drag | `use_bookmark_drag_drop.ts` |
| Bar item `:focus-visible` indicator (inset box-shadow with border-radius) | `bookmark_item_content.tsx` |
| Overflow item `.Mui-focusVisible` for trailing-elements visibility (replaces `:focus-within` to fix dot menu showing on programmatic focus) | `channel_bookmarks.scss` |
| Keyboard-reorder outline thickened to 3px (vs 2px focus indicator) on bar + overflow items | `bookmarks_bar_item.tsx`, `channel_bookmarks.scss` |
| Dot menu button `opacity:0` instead of `visibility:hidden` so it can receive focus after Escape | `bookmark_item_content.tsx` |
| Dot menu button `:focus-visible` indicator (inset box-shadow) | `channel_bookmarks.scss` |
| Move overflow menu button inline after last visible bookmark (not pinned right) | `channel_bookmarks.tsx`, `bookmarks_bar_menu.tsx` |
| Replace DotsHorizontalIcon with PlusIcon for overflow button consistency | `bookmarks_bar_menu.tsx` |
| Remove `hasOverflow` button variant — same transparent style for both | `channel_bookmarks.scss`, `bookmarks_bar_menu.tsx` |
| Reduce gap between plus icon and overflow count (1px vs 4px) | `channel_bookmarks.scss`, `bookmarks_bar_menu.tsx` |
| Fix `:active` specificity on menu button for blue click feedback | `channel_bookmarks.scss` |
| Remove opacity/background transitions for instant feedback | `channel_bookmarks.scss` |

### Extractions / refactors
| Change | Files |
|---|---|
| Extract overflow detection logic into `useBookmarksOverflow` hook | `use_bookmarks_overflow.ts` (new), `channel_bookmarks.tsx` |
| Extract shared DnD logic into `useBookmarkDragDrop` hook | `use_bookmark_drag_drop.ts` (new), `bookmarks_bar_item.tsx`, `overflow_bookmark_item.tsx` |
| Move drag preview inline styles to CSS class (`.bookmarkDragPreview`) | `drag_preview.ts`, `channel_bookmarks.scss` |
| Add `forwardRef` to `Menu.Item` — eliminates sentinel ref + `.closest('li')` hack | `menu_item.tsx`, `overflow_bookmark_item.tsx` |
| Remove unused `@atlaskit/pragmatic-drag-and-drop-live-region` dependency | `channels/package.json` |

### Keyboard accessibility
| Change | Files |
|---|---|
| Wire `getItemProps` (onKeyDown) to overflow items for keyboard reorder support | `bookmarks_bar_menu.tsx`, `overflow_bookmark_item.tsx`, `channel_bookmarks.tsx` |
| Direction-aware arrow keys: bar items use Left/Right, overflow items use Up/Down — switches on cross-container moves | `use_keyboard_reorder.ts` |
| Force-open overflow menu on bar→overflow keyboard transition; close on overflow→bar | `channel_bookmarks.tsx`, `use_keyboard_reorder.ts` |
| Fix `forceOpen` to emit `false` (not `undefined`) so Menu's `isMenuOpen` effect properly closes the menu | `channel_bookmarks.tsx` |
| Add `disableRestoreFocus` prop to `Menu.tsx`, prevent MUI stealing focus during keyboard reorder | `menu.tsx`, `bookmarks_bar_menu.tsx` |
| Fix focus fallback for overflow items (fall back to `<li>` element itself when no inner `a[tabindex]` found) | `use_keyboard_reorder.ts` |
| Confirm reorder placement on click-anywhere via new `useClickOutside` hook | `useClickOutside.ts` (new), `use_keyboard_reorder.ts` |
| Remove `[key: string]: unknown` index signature from overflow item props in favor of typed `keyboardReorderProps` | `overflow_bookmark_item.tsx` |
| Add `autoFocusItem` option to `Menu.tsx`; overflow menu disables it so no item is auto-focused on open — ArrowDown from Popover container focuses first item, then MUI handles cycling | `menu.tsx`, `bookmarks_bar_menu.tsx` |
| Block all conflicting keys during keyboard reorder (Tab, Shift+Tab, Home, End, letter keys, etc.) — only reorder controls allowed | `use_keyboard_reorder.ts` |
| Overflow item dot menu keyboard access: ArrowRight opens, ArrowLeft closes | `overflow_bookmark_item.tsx`, `bookmark_dot_menu.tsx` |
| Fix double-movement on ArrowDown/Up: stop arrow propagation in MenuList onKeyDown | `menu.tsx` |
| Stop Space/Enter propagation in MenuList when already handled (prevents menu close during reorder) | `menu.tsx` |

### Menu component improvements
| Change | Files |
|---|---|
| Auto-close menu on controlled→uncontrolled transition (`true` → `undefined`) | `menu.tsx` |
| `disableRestoreFocus` prop — passed through to MUI Popover | `menu.tsx` |
| `autoFocusItem` prop — controls MUI MenuList autoFocusItem behavior | `menu.tsx` |
| `handleMenuListKeyDown` — stops arrow/Space/Enter propagation after MenuList processes it | `menu.tsx` |
| Disable add menu items when bookmark limit reached | `bookmarks_bar_menu.tsx` |

### E2E test fixes
| Change | Files |
|---|---|
| Fix all 18 existing bookmark e2e tests for overflow and keyboard reorder | `channel_bookmarks_spec.ts` |
| Handle bar-or-overflow for bookmark assertions and dot menu access | `channel_bookmarks_spec.ts` |
| Fix modal timing, emoji scoping, reorder chain detachment | `channel_bookmarks_spec.ts` |
| Use fresh channel for reorder test to avoid overflow interference | `channel_bookmarks_spec.ts` |

---

## Skipped / Reverted

| # | Change | Reason |
|---|---|---|
| 7 | `useTextOverflow` callback ref pattern | Lifecycle mismatch — ResizeObserver on callback refs can't guarantee cleanup. Not worth pursuing. |
| 13 | `:focus-within` → `:has(:focus-visible)` for bar item dot menu | Reverted — replaced with `.Mui-focusVisible` approach for overflow items and `opacity:0` + `:focus-within` for bar items |
| — | Menubar arrow navigation (roving tabindex) | Stashed — fragile, needs rework. Deferred. |

---

## Proposed E2E Test Cases (to be added)

### `describe('overflow and reorder')` — fresh channel with 15 bookmarks

| # | Test Name | Description |
|---|---|---|
| 1 | `shows overflow count badge` | Verify overflow button visible with count, visible + overflow = total |
| 2 | `opens overflow menu and shows items` | Click button, verify items as menuitems, add actions below separator |
| 3 | `keyboard reorder within overflow` | Space → ArrowDown → Space on overflow item, verify swap |
| 4 | `keyboard reorder: Escape cancels` | Space → ArrowRight → Escape, verify original order restored |
| 5 | `keyboard reorder: click-away confirms` | Space → ArrowRight → click elsewhere, verify new position kept |
| 6 | `keyboard reorder: bar to overflow` | Move last bar item right into overflow, verify it appears in menu |
| 7 | `keyboard reorder: overflow to bar` | Move first overflow item up into bar, verify it appears in bar |

### `describe('overflow dot menu')` — fresh channel with overflow

| # | Test Name | Description |
|---|---|---|
| 8 | `edit from overflow dot menu` | Open dot menu from overflow item, edit, verify change persists |
| 9 | `delete from overflow dot menu` | Open dot menu, delete, verify item removed |

### `describe('visual feedback')` — fresh channel

| # | Test Name | Description |
|---|---|---|
| 10 | `truncated label tooltip` | Create bookmark with 200-char name, hover, verify tooltip |
| 11 | `focus-visible indicator on Tab` | Tab to bookmark, verify box-shadow focus ring |

---

## Remaining Work

### Accessibility
- [ ] Fix anchor/links in overflow menu — semantic anchor UX (deferred — MUI `<li>` structure, consider base-ui)

### Technical/patterns
- [ ] `BookmarkMeasureItem` replacement — render all items in bar with CSS overflow clipping, measure real chips instead of hidden duplicates. Eliminates 2N→N component renders. Requires rethinking overflow items (currently `Menu.Item`, would need a different approach for items hidden by CSS clipping).
- [ ] `Menu.tsx hideBackdrop` → key handler approach (medium-term)
- [ ] Replace querySelector patterns with ref registry context — `data-bookmark-id` lookup for refocus, menu ArrowDown entry, dot menu ArrowRight. Low priority since queries are scoped and cross component boundaries where ref threading adds complexity.

### Potential enhancements
- [ ] Register bookmarks bar as A11yController region for F6/Ctrl+` cycling
- [ ] Menubar arrow navigation (roving tabindex) — stashed, needs rework

### Deferred
- [ ] Drag-away close overflow behavior (decided: close on drag-away, not yet implemented)
- [ ] `openBookmark` imperative navigation code smell

### Separate PR
- [ ] `ScheduledPostIndicator` selector memoization
