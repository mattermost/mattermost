# Bookmarks Overflow DnD with pragmatic-drag-and-drop (from master)

## Context

Master's bookmarks bar uses `react-beautiful-dnd` with a single horizontal `Droppable` — no overflow menu, no cross-container. All items scroll horizontally. The branch (MM-56762) added overflow detection and cross-container DnD via @dnd-kit, but accumulated 5+ hacks fighting MUI portals and event propagation.

**This plan:** Start fresh from master's simple implementation. Replace `react-beautiful-dnd` with `@atlaskit/pragmatic-drag-and-drop` and build overflow + cross-container from scratch with a clean architecture.

## Master's Current State (starting point)

| File | Description |
|------|-------------|
| `channel_bookmarks.tsx` | 107 lines. `DragDropContext` + `Droppable` (horizontal) + `Draggable` per item. `overflow-x: auto` (scrolls, no overflow menu). |
| `bookmark_item.tsx` | Combined component: `useBookmarkLink` hook + `BookmarkItem` + `DynamicLink` + all styled components. Takes `DraggableProvided` from rbd. |
| `channel_bookmarks_menu.tsx` | Add-bookmark menu (link/file). No overflow items. |
| `bookmark_dot_menu.tsx` | Dot menu per bookmark (edit/delete/copy). |
| `utils.ts` | `useChannelBookmarks` (order, bookmarks, reorder), permissions. |
| No hooks/ directory | No custom DnD hook. |
| No overflow detection | No `BookmarkMeasureItem`, no `calculateOverflow`. |

## Packages

**Install:**
```
npm add @atlaskit/pragmatic-drag-and-drop @atlaskit/pragmatic-drag-and-drop-hitbox --workspace=channels
```

**Remove (react-beautiful-dnd already deprecated):**
- `react-beautiful-dnd` is used elsewhere in the codebase (check before removing)
- At minimum, remove it from bookmark_item.tsx imports

## Keyboard DnD

Native HTML DnD doesn't support keyboard drag. Deferred to follow-up — add "Move left/right" in dot menu or arrow-key shortcuts that call `onReorder` directly.

## Visual Model

**Drop indicator** (thin 2px line on closest edge) replaces rbd's placeholder/shifting behavior. This is the Trello/Jira pattern. Items don't shift during drag — the indicator shows where the drop will land.

---

## Step 1: Install pragmatic-dnd packages

```
npm add @atlaskit/pragmatic-drag-and-drop @atlaskit/pragmatic-drag-and-drop-hitbox --workspace=channels
```

---

## Step 2: Create shared components

### `drop_indicator.tsx` (new)

2px colored line (`var(--button-bg)`) positioned absolutely on the specified edge.

```tsx
interface DropIndicatorProps {
    edge: 'left' | 'right' | 'top' | 'bottom';
}
```

- Bar items (horizontal): left/right, full height
- Overflow items (vertical): top/bottom, full width

### `bookmark_item_content.tsx` (extract from `bookmark_item.tsx`)

Master's `bookmark_item.tsx` bundles the link rendering, icon, label, dot menu, AND the rbd `DraggableProvided` wiring. Split it:

- `bookmark_item_content.tsx` — presentational: `useBookmarkLink`, `DynamicLink`, icon, label, dot menu. No DnD awareness. Accepts `disableInteractions` and `disableLinks` props.
- This component is shared between bar items, overflow items, and the drag preview.
- Carry over href-stripping logic (`disableLinks` → `DynamicLink` renders `<span>` instead of anchor).

### `bookmarks_measure_item.tsx` (new — from branch)

Hidden measurement component for overflow calculation. Same as branch implementation — `position: absolute; visibility: hidden`, matches bar item dimensions, reports width via `onMount` ref callback.

---

## Step 3: Add overflow detection to `channel_bookmarks.tsx`

Before wiring DnD, add the overflow measurement system:

- `containerRef`, `itemRefs` map, `calculateOverflow` function
- `ResizeObserver` for dynamic recalculation
- `overflowStartIndex` state → splits `order` into `visibleItems` / `overflowItems`
- Render `BookmarkMeasureItem` for all items (hidden, consistent measurement)
- Replace `overflow-x: auto` with `overflow: hidden` on the bar container

This is independent of the DnD library. Reuse the branch's overflow logic.

---

## Step 4: Create `BookmarksBarMenu` with overflow items

### `bookmarks_bar_menu.tsx` (new)

Menu component that shows:
- Overflow bookmark items (when `overflowItems.length > 0`)
- Add bookmark options (link/file)

Props: `channelId`, `overflowItems`, `bookmarks`, `hasBookmarks`, `limitReached`, `canUploadFiles`, `canReorder`, `isDragging`, `forceOpen?`, `onOpenChange?`

Uses `Menu.Container` with:
- `isMenuOpen: forceOpen` for auto-open during drag
- `onToggle: handleToggle` for tracking open state
- `hideBackdrop: isDragging` for allowing bar interaction during drag (test if needed with native DnD)

### `overflow_bookmark_item.tsx` (new)

Overflow menu item with pragmatic-dnd `draggable()` + `dropTargetForElements()`:
- `getInitialData: () => ({ type: 'bookmark', bookmarkId: id, container: 'overflow' })`
- `attachClosestEdge` with `allowedEdges: ['top', 'bottom']`
- Local `isDragging` and `closestEdge` state
- Renders `BookmarkItemContent` + `BookmarkItemDotMenu`
- Shows `<DropIndicator edge={closestEdge} />` when hovering

Also register a `dropTargetForElements` on the `MenuContainer` div as an auto-open trigger zone:
- `onDragEnter`: signal parent to open overflow menu
- `getData: () => ({ type: 'overflow-trigger' })`

---

## Step 5: Rewrite bar item with pragmatic-dnd

### `bookmarks_bar_item.tsx` (replaces `bookmark_item.tsx`)

Each bar item self-registers as both draggable and drop target:

```tsx
useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return combine(
        draggable({
            element: el,
            getInitialData: () => ({ type: 'bookmark', bookmarkId: id, container: 'bar' }),
            onGenerateDragPreview: ({ nativeSetDragImage }) => {
                setCustomNativeDragPreview({
                    nativeSetDragImage,
                    getOffset: pointerOutsideOfPreview({ x: '16px', y: '8px' }),
                    render: ({ container }) => { /* render BookmarkItemContent */ },
                });
            },
            onDragStart: () => setDragging(true),
            onDrop: () => setDragging(false),
            canDrag: () => !disabled,
        }),
        dropTargetForElements({
            element: el,
            getData: ({ input, element }) =>
                attachClosestEdge(
                    { type: 'bookmark', bookmarkId: id, container: 'bar' },
                    { input, element, allowedEdges: ['left', 'right'] },
                ),
            canDrop: ({ source }) => source.data.type === 'bookmark' && source.data.bookmarkId !== id,
            onDrag: ({ self }) => setClosestEdge(extractClosestEdge(self.data)),
            onDragLeave: () => setClosestEdge(null),
            onDrop: () => setClosestEdge(null),
        }),
    );
}, [id, disabled]);
```

- Renders `BookmarkItemContent` + `<DropIndicator>` when `closestEdge` set
- `isDragging` → opacity 0.5
- `disableInteractions` when any drag is active
- Keep Space keydown `stopPropagation` to prevent message input stealing focus

---

## Step 6: Create DnD coordination hook

### `hooks/use_bookmarks_dnd.ts` (new)

Uses `monitorForElements` to coordinate cross-container logic.

```typescript
interface UseBookmarksDndResult {
    isDragging: boolean;
    activeId: string | null;
    autoOpenOverflow: boolean;
    setAutoOpenOverflow: (open: boolean) => void;
}
```

The monitor:
- `canMonitor: ({source}) => source.data.type === 'bookmark'`
- `onDragStart`: set `activeId`, snapshot state
- `onDrop`: calculate final combined index from drop target data + edge, call `onReorder()`, reset
- `onDropTargetChange`: detect when drag enters overflow-trigger zone → `setAutoOpenOverflow(true)`

**Drop index calculation:**
```typescript
const sourceId = source.data.bookmarkId;
const target = location.current.dropTargets[0];
if (!target || target.data.type === 'overflow-trigger') {
    // Dropped on trigger zone = append to end of overflow
}
const edge = extractClosestEdge(target.data);
const targetContainer = target.data.container; // 'bar' or 'overflow'
// Use getReorderDestinationIndex or manual edge→index math
```

**No real-time localOrder shuffling.** Items don't visually move between containers during drag — the drop indicator shows where the item will land. On drop, the `onReorder` API call fires and Redux updates the order. This eliminates all the stale-closure, infinite-loop, and combined-state complexity.

---

## Step 7: Wire everything in `channel_bookmarks.tsx`

Replace master's `DragDropContext`/`Droppable`/`Draggable` with:

```tsx
<Container ref={containerRef}>
    <BookmarksBarContent>
        {order.map(id => <BookmarkMeasureItem key={`m-${id}`} ... />)}
        {visibleItems.map(id => (
            <BookmarksBarItem key={id} id={id} bookmark={bookmarks[id]} disabled={!canReorder} isDraggingGlobal={isDragging} />
        ))}
    </BookmarksBarContent>
    <BookmarksBarMenu
        overflowItems={overflowItems}
        isDragging={isDragging}
        forceOpen={isDragging ? autoOpenOverflow : undefined}
        onOpenChange={setAutoOpenOverflow}
        ...
    />
</Container>
```

No DndContext wrapper. No DragOverlay. No SortableContext. No sensors. No Escape hack. No measuring strategy. Items self-register. Monitor coordinates.

Wire hook: `isDragging`, `activeId`, `autoOpenOverflow` from `useBookmarksDnd`.

Pass `isDraggingRef` for debounced overflow recalculation (same pattern as branch).

---

## Step 8: Clean up

- Remove `react-beautiful-dnd` imports from bookmarks (check if used elsewhere before removing package)
- Delete master's `bookmark_item.tsx` (replaced by `bookmarks_bar_item.tsx` + `bookmark_item_content.tsx`)
- Verify no @dnd-kit references remain
- Run build, lint, tests

---

## Files Summary

| File | Action |
|------|--------|
| `channel_bookmarks.tsx` | **Rewrite** — overflow detection + pragmatic-dnd monitor wiring |
| `bookmark_item.tsx` | **Delete** — split into bar_item + item_content |
| `bookmarks_bar_item.tsx` | **Create** — bar draggable/droppable with pragmatic-dnd |
| `bookmark_item_content.tsx` | **Create** — shared presentational (link, icon, label, dot menu) |
| `overflow_bookmark_item.tsx` | **Create** — overflow draggable/droppable with pragmatic-dnd |
| `bookmarks_bar_menu.tsx` | **Create** — overflow menu + add options + auto-open trigger |
| `bookmarks_measure_item.tsx` | **Create** — hidden measurement for overflow calc |
| `drop_indicator.tsx` | **Create** — edge indicator component |
| `hooks/use_bookmarks_dnd.ts` | **Create** — monitor-based coordination hook |
| `hooks/index.ts` | **Create** — exports |
| `channel_bookmarks.scss` | **Edit** — drop indicator styles, overflow button styles |
| `bookmark_dot_menu.tsx` | **Edit** — add `buttonClassName` prop for overflow size variant |
| `menu.tsx` | **Edit** — keep bi-directional `isMenuOpen`, test if `hideBackdrop`/`disableEscapeKeyDown` still needed |
| `utils.ts` | **No change** |
| `channel_bookmarks_menu.tsx` | **Delete or merge** — add-bookmark options move into `bookmarks_bar_menu.tsx` |

## Verification

- [ ] Bar reorder: drag chip left/right, drop indicator on edges, drop reorders
- [ ] Overflow reorder: drag item up/down in menu, drop indicator, drop reorders
- [ ] Bar → overflow: drag toward menu button, auto-opens, drag into menu, drop
- [ ] Overflow → bar: drag from menu into bar, drop indicator between chips, drop
- [ ] Escape cancels drag (native — no hacks needed)
- [ ] Drop outside cancels (no reorder)
- [ ] Menu stays open after reorder within overflow
- [ ] Links navigate normally when not dragging
- [ ] Links don't navigate during drag (href stripping)
- [ ] Custom drag preview follows cursor
- [ ] `canReorder=false` disables dragging
- [ ] Overflow calculation correct after drag
- [ ] Build: `cd webapp/channels && npx tsc --noEmit`
- [ ] Lint: `cd webapp && npm run check --workspace=channels`
- [ ] Tests: `npm run test --workspace=channels -- --testPathPatterns=channel_bookmarks`
