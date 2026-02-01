# Channel Bookmarks: Overflow Menu & Folder Support

**Jira Ticket:** MM-56762
**Author:** Claude Code
**Date:** 2026-01-29
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [UX Specification](#ux-specification)
4. [Technical Specification](#technical-specification)
5. [Migration Strategy](#migration-strategy)
6. [Testing Plan](#testing-plan)
7. [Rollout Strategy](#rollout-strategy)
8. [Appendix](#appendix)

---

## Executive Summary

This specification outlines improvements to the Mattermost Channel Bookmarks Bar:

1. **Overflow Menu Pattern** - Replace horizontal scrolling with a dynamic overflow menu that shows hidden bookmarks in a dropdown
2. **Cross-List Drag and Drop** - Enable dragging bookmarks between the visible bar and overflow menu
3. **Folder Support** - Add nested bookmark folders using existing `parent_id` schema field

### Key Outcomes

- Improved discoverability of bookmarks (no hidden content requiring scroll)
- Better UX on narrow viewports and mobile
- Enhanced organization through folders
- Modern drag-and-drop with cross-list support

---

## Current State Analysis

### Architecture Overview

```
webapp/channels/src/components/channel_bookmarks/
├── channel_bookmarks.tsx        # Main container + DragDropContext
├── bookmark_item.tsx            # Individual draggable item
├── bookmark_icon.tsx            # Icon renderer (emoji/image/file)
├── bookmark_dot_menu.tsx        # Item context menu
├── channel_bookmarks_menu.tsx   # Add bookmark menu (sticky)
├── channel_bookmarks_create_modal.tsx
├── bookmark_delete_modal.tsx
└── utils.ts                     # Hooks and permissions
```

### Current Behavior

| Aspect | Current Implementation |
|--------|----------------------|
| **Overflow** | `overflow-x: auto` (horizontal scroll) |
| **Drag Library** | `react-beautiful-dnd` v13.1.1 (deprecated) |
| **Drag Direction** | Horizontal only (`direction='horizontal'`) |
| **Menu Position** | Sticky right with gradient overlay |
| **Folder Support** | Schema exists (`parent_id`), UI not implemented |

### Pain Points

1. **Hidden Content** - Bookmarks beyond viewport require scrolling to discover
2. **Scroll Interaction** - Horizontal scroll conflicts with page scroll on touch devices
3. **Deprecated Library** - `react-beautiful-dnd` is archived (August 2024)
4. **Single-Axis DnD** - Cannot drag between bar and dropdown menus
5. **Flat Structure** - No organization beyond order

### Existing Schema (Parent ID Support)

```go
// server/public/model/channel_bookmark.go
type ChannelBookmark struct {
    // ... existing fields ...
    ParentId    string `json:"parent_id,omitempty"` // Already exists!
}
```

```sql
-- Database migration already includes:
parentid varchar(26) DEFAULT NULL
```

---

## UX Specification

### 1. Overflow Menu Pattern

#### 1.1 Behavior

When bookmarks exceed available width:

1. Visible bookmarks render up to container width minus overflow button space
2. An overflow button (chevron/count indicator) appears at the right edge
3. Hidden bookmarks appear in a dropdown menu when overflow is clicked
4. Dropdown shows bookmarks in the same order as the bar

```
┌─────────────────────────────────────────────────────────────────┐
│ [📋 Docs] [🔗 API Ref] [📊 Metrics] [+3 ▼] [➕]                 │
└─────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
                               ┌────────────────┐
                               │ 📦 Assets      │
                               │ 🔧 Config      │
                               │ 📝 Notes       │
                               └────────────────┘
```

#### 1.2 Overflow Button States

| State | Display | Behavior |
|-------|---------|----------|
| No overflow | Hidden | N/A |
| 1-9 hidden | `+N ▼` | Click opens dropdown |
| 10+ hidden | `+N ▼` | Click opens dropdown |
| During drag | Expanded + highlighted | Auto-opens for drop target |

#### 1.3 Responsive Breakpoints

| Viewport Width | Behavior |
|----------------|----------|
| > 1200px | Show up to ~15 bookmarks |
| 900-1200px | Show up to ~10 bookmarks |
| 600-900px | Show up to ~6 bookmarks |
| < 600px | Show up to ~3 bookmarks |

#### 1.4 Animation Specifications

- **Enter/Exit** - 150ms ease-out opacity and transform
- **Reorder** - 200ms spring animation for position changes
- **Overflow transition** - 100ms when items move between bar/menu

### 2. Cross-List Drag and Drop

#### 2.1 Interaction Model

```
Bar:     [A] [B] [C] [D]  [+2 ▼]  [➕]
                            │
         Drag [E] from     ▼
         overflow menu   ┌──────┐
                        │ [E] │ ← Dragging this
                        │ [F]  │
                        └──────┘

Result:  [A] [B] [E] [C] [D]  [+2 ▼]  [➕]
         (D and one item pushed to overflow)
```

#### 2.2 Drop Zones

1. **Between visible bookmarks** - Insert at position
2. **At end of visible bar** - Append to visible area
3. **In overflow menu** - Insert at menu position
4. **On folder** - Add to folder (future)

#### 2.3 Drag Affordances

- **Drag handle** - Entire bookmark item is draggable
- **Visual feedback** -
  - Dragged item: slight scale (1.02), shadow, reduced opacity at source
  - Drop zone: blue highlight line between items
  - Invalid zone: red tint or no indicator
- **Auto-scroll** - Overflow menu auto-opens when dragging near it

#### 2.4 Accessibility

- **Keyboard reorder** - Space to grab, arrows to move, Space to drop
- **Screen reader** - Live region announces position changes
- **Focus management** - Focus follows dragged item

### 3. Folder Support (Future Phase)

#### 3.1 Folder Visual Design

```
Bar with folders:
┌─────────────────────────────────────────────────────────────────┐
│ [📋 Docs] [📁 Resources ▼] [🔗 API] [📁 Team ▼] [+2 ▼] [➕]    │
└─────────────────────────────────────────────────────────────────┘
                   │
                   ▼
          ┌─────────────────┐
          │ 📦 Assets       │
          │ 📊 Metrics      │
          │ 🔧 Config       │
          │ ─────────────── │
          │ ✏️ Edit folder  │
          │ 🗑️ Delete       │
          └─────────────────┘
```

#### 3.2 Folder Operations

| Action | Trigger | Result |
|--------|---------|--------|
| Create folder | Add menu → "New folder" | Empty folder with name prompt |
| Add to folder | Drag onto folder | Item's `parent_id` set to folder ID |
| Remove from folder | Drag out to bar | Item's `parent_id` cleared |
| Reorder in folder | Drag within folder menu | Sort order updated |
| Rename folder | Folder menu → Edit | Modal with name input |
| Delete folder | Folder menu → Delete | Confirmation, items move to bar |

#### 3.3 Folder Data Model

```typescript
// Folder is a bookmark with type "folder" (new type)
interface ChannelBookmarkFolder extends ChannelBookmark {
    type: 'folder';
    // link_url, file_id unused for folders
}

// Child bookmarks reference folder via parent_id
interface ChannelBookmark {
    parent_id?: string; // References folder's ID
}
```

#### 3.4 Folder Constraints

- Maximum nesting depth: 1 (folders cannot contain folders)
- Maximum items per folder: 50 (matches channel limit)
- Folder names: 1-64 characters
- Empty folders: Allowed, show "(empty)" in dropdown

### 4. Empty & Loading States

#### 4.1 Empty State

```
┌─────────────────────────────────────────────────────────────────┐
│ [➕ Add a bookmark]                                              │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.2 Loading State

```
┌─────────────────────────────────────────────────────────────────┐
│ [░░░░░] [░░░░░░░] [░░░░]                                        │
└─────────────────────────────────────────────────────────────────┘
```

Skeleton placeholders with shimmer animation.

### 5. Error States

- **Drag failed** - Toast notification, item returns to original position
- **Network error** - Inline error with retry option
- **Permission denied** - Disabled drag handles, tooltip explains

---

## Technical Specification

### 1. Drag and Drop Library Selection

#### Recommendation: `@dnd-kit/core`

| Criteria | @dnd-kit | pragmatic-drag-and-drop |
|----------|----------|-------------------------|
| Bundle size | ~10kb | ~4.7kb |
| Documentation | Excellent | Good (improving) |
| Community | Large, active | Growing |
| Cross-list DnD | Native support | Native support |
| Multi-axis | Yes | Yes |
| React 18+ | Yes | Yes |
| Accessibility | Built-in | Built-in |
| Maintenance | Very active | Active (Atlassian) |

**Decision:** Use `@dnd-kit/core` for:
- Superior documentation and examples
- Proven patterns for complex scenarios
- Active community support
- Flexible architecture for overflow menus

#### Migration Path

```typescript
// Before (react-beautiful-dnd)
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

// After (@dnd-kit)
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    horizontalListSortingStrategy,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
```

### 2. Component Architecture

#### 2.1 New Component Tree

```
channel_bookmarks/
├── ChannelBookmarksBar.tsx          # Main container
├── BookmarksBarContent.tsx          # Visible bookmarks
├── BookmarksOverflowMenu.tsx        # Overflow dropdown
├── BookmarksSortableItem.tsx        # Sortable wrapper
├── BookmarkItem.tsx                 # Display component
├── BookmarkFolder.tsx               # Folder component (future)
├── BookmarkFolderMenu.tsx           # Folder dropdown (future)
├── contexts/
│   └── BookmarksDndContext.tsx      # DnD context provider
├── hooks/
│   ├── useBookmarksOverflow.ts      # Overflow calculation
│   ├── useBookmarksDnd.ts           # DnD handlers
│   └── useBookmarksFolders.ts       # Folder operations (future)
└── utils/
    ├── overflowCalculator.ts        # Width calculations
    └── sortableHelpers.ts           # DnD utilities
```

#### 2.2 Overflow Calculation Hook

```typescript
// hooks/useBookmarksOverflow.ts
interface UseBookmarksOverflowOptions {
    containerRef: RefObject<HTMLElement>;
    itemRefs: Map<string, HTMLElement>;
    items: string[]; // Ordered bookmark IDs
    minVisibleItems?: number;
    overflowButtonWidth?: number;
}

interface UseBookmarksOverflowResult {
    visibleItems: string[];
    overflowItems: string[];
    showOverflow: boolean;
    recalculate: () => void;
}

export function useBookmarksOverflow(
    options: UseBookmarksOverflowOptions
): UseBookmarksOverflowResult {
    const [splitIndex, setSplitIndex] = useState(options.items.length);

    useLayoutEffect(() => {
        // ResizeObserver on container
        // Calculate cumulative widths
        // Find split point where items + overflow button fit
        // Update splitIndex
    }, [options.items, containerWidth]);

    return {
        visibleItems: options.items.slice(0, splitIndex),
        overflowItems: options.items.slice(splitIndex),
        showOverflow: splitIndex < options.items.length,
        recalculate,
    };
}
```

#### 2.3 Cross-List DnD Setup

```typescript
// contexts/BookmarksDndContext.tsx
export function BookmarksDndProvider({ children, channelId }: Props) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeContainer = getContainer(active.id);
        const overContainer = getContainer(over.id);

        if (activeContainer === overContainer) {
            // Same container reorder
            reorderWithinContainer(active.id, over.id);
        } else {
            // Cross-container move
            moveToContainer(active.id, overContainer, over.id);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
        >
            {children}
        </DndContext>
    );
}
```

#### 2.4 Main Component Refactor

```typescript
// ChannelBookmarksBar.tsx
export function ChannelBookmarksBar({ channelId }: Props) {
    const { order, bookmarks, reorder } = useChannelBookmarks(channelId);
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef(new Map<string, HTMLElement>());

    const { visibleItems, overflowItems, showOverflow } = useBookmarksOverflow({
        containerRef,
        itemRefs: itemRefs.current,
        items: order,
    });

    return (
        <BookmarksDndProvider channelId={channelId} onReorder={reorder}>
            <Container ref={containerRef}>
                <SortableContext
                    items={visibleItems}
                    strategy={horizontalListSortingStrategy}
                    id="bookmarks-bar"
                >
                    {visibleItems.map((id) => (
                        <BookmarksSortableItem
                            key={id}
                            id={id}
                            bookmark={bookmarks[id]}
                            ref={(el) => el && itemRefs.current.set(id, el)}
                        />
                    ))}
                </SortableContext>

                {showOverflow && (
                    <BookmarksOverflowMenu
                        items={overflowItems}
                        bookmarks={bookmarks}
                    />
                )}

                <BookmarksAddMenu channelId={channelId} />
            </Container>
        </BookmarksDndProvider>
    );
}
```

### 3. API Changes

#### 3.1 Folder Type Addition (Backend)

```go
// server/public/model/channel_bookmark.go
const (
    ChannelBookmarkLink   ChannelBookmarkType = "link"
    ChannelBookmarkFile   ChannelBookmarkType = "file"
    ChannelBookmarkFolder ChannelBookmarkType = "folder" // NEW
)
```

#### 3.2 Folder Validation

```go
func (o *ChannelBookmark) IsValid() *AppError {
    // ... existing validation ...

    // Folder-specific validation
    if o.Type == ChannelBookmarkFolder {
        if o.LinkUrl != "" || o.FileId != "" {
            return NewAppError("ChannelBookmark.IsValid",
                "model.channel_bookmark.is_valid.folder_no_content.app_error",
                nil, "id="+o.Id, http.StatusBadRequest)
        }
        if o.ParentId != "" {
            // Folders cannot be nested
            return NewAppError("ChannelBookmark.IsValid",
                "model.channel_bookmark.is_valid.folder_no_nesting.app_error",
                nil, "id="+o.Id, http.StatusBadRequest)
        }
    }

    // Items cannot be nested more than one level
    if o.ParentId != "" {
        parent, err := store.ChannelBookmark().Get(o.ParentId)
        if err == nil && parent.ParentId != "" {
            return NewAppError("ChannelBookmark.IsValid",
                "model.channel_bookmark.is_valid.max_nesting.app_error",
                nil, "id="+o.Id, http.StatusBadRequest)
        }
    }

    return nil
}
```

#### 3.3 New API Endpoints

```
# Move bookmark to folder (or out of folder)
PATCH /api/v4/channels/{channel_id}/bookmarks/{bookmark_id}/parent
Body: { "parent_id": "folder_id" | "" }

# Get bookmarks with folder structure
GET /api/v4/channels/{channel_id}/bookmarks?include_children=true
Response: Nested structure with folders containing children
```

### 4. State Management

#### 4.1 Redux State Shape

```typescript
// Current
state.entities.channelBookmarks: {
    byChannelId: {
        [channelId]: {
            [bookmarkId]: ChannelBookmark
        }
    }
}

// Enhanced (no schema change, just selector changes)
// Selectors will group by parent_id for folder support
```

#### 4.2 New Selectors

```typescript
// selectors/entities/channel_bookmarks.ts

// Get root-level bookmarks (no parent)
export const getRootBookmarks = createSelector(
    [getChannelBookmarks],
    (bookmarks) => Object.values(bookmarks)
        .filter(b => !b.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order)
);

// Get bookmarks in a folder
export const getFolderBookmarks = createSelector(
    [getChannelBookmarks, (_, folderId: string) => folderId],
    (bookmarks, folderId) => Object.values(bookmarks)
        .filter(b => b.parent_id === folderId)
        .sort((a, b) => a.sort_order - b.sort_order)
);

// Get all folders
export const getBookmarkFolders = createSelector(
    [getChannelBookmarks],
    (bookmarks) => Object.values(bookmarks)
        .filter(b => b.type === 'folder')
        .sort((a, b) => a.sort_order - b.sort_order)
);
```

### 5. Performance Considerations

#### 5.1 Render Optimization

```typescript
// Memoize individual bookmark items
const MemoizedBookmarkItem = memo(BookmarkItem, (prev, next) => {
    return (
        prev.bookmark.id === next.bookmark.id &&
        prev.bookmark.update_at === next.bookmark.update_at &&
        prev.isDragging === next.isDragging
    );
});
```

#### 5.2 Overflow Calculation Debouncing

```typescript
// Debounce resize calculations
const debouncedRecalculate = useMemo(
    () => debounce(recalculate, 100),
    [recalculate]
);

useEffect(() => {
    const observer = new ResizeObserver(debouncedRecalculate);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
}, []);
```

#### 5.3 Virtual Rendering for Large Overflow

```typescript
// For overflow menus with many items
import { useVirtualizer } from '@tanstack/react-virtual';

function BookmarksOverflowMenu({ items }: Props) {
    const parentRef = useRef<HTMLDivElement>(null);

    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40, // Item height
        overscan: 5,
    });

    // Only render visible items
}
```

---

## Migration Strategy

### Phase 1: Library Migration (No Visible Changes)

1. Add `@dnd-kit/core` and `@dnd-kit/sortable` dependencies
2. Create new DnD context and hooks alongside existing
3. Feature flag: `ChannelBookmarksDndKit`
4. A/B test performance and behavior
5. Remove `react-beautiful-dnd` after validation

### Phase 2: Overflow Menu

1. Implement `useBookmarksOverflow` hook
2. Create `BookmarksOverflowMenu` component
3. Update main component to use overflow
4. Feature flag: `ChannelBookmarksOverflow`
5. Remove horizontal scroll CSS

### Phase 3: Cross-List Drag and Drop

1. Implement cross-container DnD handlers
2. Add drag-over states for overflow menu
3. Update reorder API calls for cross-list moves
4. QA cross-list interactions

### Phase 4: Folder Support (Future)

1. Add `folder` bookmark type validation
2. Create folder UI components
3. Implement folder CRUD operations
4. Add drag-to-folder interactions
5. Feature flag: `ChannelBookmarksFolders`

---

## Testing Plan

### 1. Unit Tests

#### 1.1 Overflow Calculation

```typescript
describe('useBookmarksOverflow', () => {
    it('shows all items when container is wide enough', () => {
        // Container: 1000px, items: 5 × 100px each
        const { visibleItems, showOverflow } = renderHook(() =>
            useBookmarksOverflow({ items: ['a','b','c','d','e'], containerWidth: 1000 })
        );
        expect(visibleItems).toHaveLength(5);
        expect(showOverflow).toBe(false);
    });

    it('moves items to overflow when container shrinks', () => {
        // Container: 350px, items: 5 × 100px each, overflow button: 50px
        const { visibleItems, overflowItems, showOverflow } = renderHook(() =>
            useBookmarksOverflow({ items: ['a','b','c','d','e'], containerWidth: 350 })
        );
        expect(visibleItems).toHaveLength(3);
        expect(overflowItems).toHaveLength(2);
        expect(showOverflow).toBe(true);
    });

    it('respects minimum visible items', () => {
        // Even in tiny container, show at least 1 item
        const { visibleItems } = renderHook(() =>
            useBookmarksOverflow({ items: ['a','b','c'], containerWidth: 50, minVisibleItems: 1 })
        );
        expect(visibleItems.length).toBeGreaterThanOrEqual(1);
    });
});
```

#### 1.2 DnD Handlers

```typescript
describe('useBookmarksDnd', () => {
    it('reorders within same container', async () => {
        const reorderMock = jest.fn();
        const { result } = renderHook(() => useBookmarksDnd({ onReorder: reorderMock }));

        act(() => {
            result.current.handleDragEnd({
                active: { id: 'bookmark-1' },
                over: { id: 'bookmark-3' },
                // Both in 'bar' container
            });
        });

        expect(reorderMock).toHaveBeenCalledWith('bookmark-1', 0, 2);
    });

    it('moves item between containers', async () => {
        const moveMock = jest.fn();
        const { result } = renderHook(() => useBookmarksDnd({ onMove: moveMock }));

        act(() => {
            result.current.handleDragEnd({
                active: { id: 'bookmark-1', data: { current: { container: 'overflow' } } },
                over: { id: 'bookmark-2', data: { current: { container: 'bar' } } },
            });
        });

        expect(moveMock).toHaveBeenCalledWith('bookmark-1', 'bar', 1);
    });
});
```

#### 1.3 Folder Operations

```typescript
describe('folder operations', () => {
    it('creates folder bookmark', async () => {
        const { result } = renderHook(() => useBookmarkFolders('channel-1'));

        await act(async () => {
            await result.current.createFolder('My Folder');
        });

        expect(mockApi.createBookmark).toHaveBeenCalledWith('channel-1', {
            type: 'folder',
            display_name: 'My Folder',
        });
    });

    it('moves bookmark into folder', async () => {
        const { result } = renderHook(() => useBookmarkFolders('channel-1'));

        await act(async () => {
            await result.current.moveToFolder('bookmark-1', 'folder-1');
        });

        expect(mockApi.updateBookmarkParent).toHaveBeenCalledWith(
            'channel-1', 'bookmark-1', 'folder-1'
        );
    });

    it('prevents folder nesting', async () => {
        const { result } = renderHook(() => useBookmarkFolders('channel-1'));

        await expect(
            result.current.moveToFolder('folder-2', 'folder-1')
        ).rejects.toThrow('Folders cannot be nested');
    });
});
```

### 2. Integration Tests

#### 2.1 Component Integration

```typescript
describe('ChannelBookmarksBar', () => {
    it('renders visible bookmarks and overflow menu', async () => {
        render(<ChannelBookmarksBar channelId="ch1" />, {
            initialState: {
                entities: {
                    channelBookmarks: {
                        byChannelId: {
                            ch1: mockBookmarks(10), // More than fits
                        },
                    },
                },
            },
        });

        // Check visible items
        expect(screen.getAllByTestId('bookmark-item')).toHaveLength(/* based on width */);

        // Check overflow button
        expect(screen.getByTestId('overflow-menu-button')).toBeInTheDocument();
        expect(screen.getByText(/\+\d+/)).toBeInTheDocument();
    });

    it('opens overflow menu and shows hidden items', async () => {
        render(<ChannelBookmarksBar channelId="ch1" />);

        await userEvent.click(screen.getByTestId('overflow-menu-button'));

        expect(screen.getByRole('menu')).toBeInTheDocument();
        // Hidden items now visible in menu
    });

    it('handles drag from bar to overflow', async () => {
        render(<ChannelBookmarksBar channelId="ch1" />);

        const item = screen.getByTestId('bookmark-item-1');
        const overflowDropZone = screen.getByTestId('overflow-drop-zone');

        await drag(item).to(overflowDropZone);

        expect(mockReorderApi).toHaveBeenCalled();
    });
});
```

### 3. E2E Tests

#### 3.1 Cypress Tests

```typescript
// e2e-tests/cypress/tests/integration/channels/bookmarks_overflow_spec.ts

describe('Channel Bookmarks Overflow', () => {
    beforeEach(() => {
        cy.apiCreateChannel('test-team', 'test-channel');
        // Create 15 bookmarks to ensure overflow
        for (let i = 0; i < 15; i++) {
            cy.apiCreateChannelBookmark('test-channel', {
                display_name: `Bookmark ${i}`,
                link_url: `https://example.com/${i}`,
            });
        }
        cy.visit('/test-team/channels/test-channel');
    });

    it('shows overflow button when bookmarks exceed width', () => {
        cy.get('[data-testid="overflow-menu-button"]').should('be.visible');
        cy.get('[data-testid="overflow-menu-button"]').should('contain.text', '+');
    });

    it('opens overflow menu on click', () => {
        cy.get('[data-testid="overflow-menu-button"]').click();
        cy.get('[role="menu"]').should('be.visible');
        cy.get('[role="menuitem"]').should('have.length.greaterThan', 0);
    });

    it('drags bookmark from overflow to bar', () => {
        cy.get('[data-testid="overflow-menu-button"]').click();

        cy.get('[role="menuitem"]').first().drag('[data-testid="bookmarks-bar"]', {
            target: { x: 100, y: 20 },
        });

        // Verify bookmark moved to bar
        cy.get('[data-testid="bookmarks-bar"] [data-testid^="bookmark-item"]')
            .should('contain.text', 'Bookmark 10'); // Previously in overflow
    });

    it('keyboard navigation works in overflow menu', () => {
        cy.get('[data-testid="overflow-menu-button"]').focus().type('{enter}');
        cy.get('[role="menu"]').should('be.visible');

        cy.focused().type('{downarrow}{downarrow}{enter}');
        // Should select and activate third item
    });

    it('handles viewport resize', () => {
        // Start wide - fewer items in overflow
        cy.viewport(1400, 800);
        cy.get('[data-testid="overflow-menu-button"]').should('contain.text', '+3');

        // Shrink viewport - more items in overflow
        cy.viewport(800, 800);
        cy.get('[data-testid="overflow-menu-button"]').should('contain.text', '+8');
    });
});
```

#### 3.2 Folder E2E Tests

```typescript
describe('Channel Bookmarks Folders', () => {
    beforeEach(() => {
        cy.apiCreateChannel('test-team', 'test-channel');
        cy.visit('/test-team/channels/test-channel');
    });

    it('creates a folder', () => {
        cy.get('[data-testid="add-bookmark-button"]').click();
        cy.get('[data-testid="add-folder-option"]').click();

        cy.get('input[name="folder-name"]').type('Resources');
        cy.get('button[type="submit"]').click();

        cy.get('[data-testid="bookmarks-bar"]')
            .should('contain.text', 'Resources');
    });

    it('drags bookmark into folder', () => {
        // Create folder and bookmark
        cy.apiCreateBookmarkFolder('test-channel', 'Resources');
        cy.apiCreateChannelBookmark('test-channel', { display_name: 'Doc' });
        cy.reload();

        cy.get('[data-testid="bookmark-Doc"]').drag('[data-testid="folder-Resources"]');

        // Open folder to verify
        cy.get('[data-testid="folder-Resources"]').click();
        cy.get('[role="menu"]').should('contain.text', 'Doc');
    });

    it('shows empty folder state', () => {
        cy.apiCreateBookmarkFolder('test-channel', 'Empty Folder');
        cy.reload();

        cy.get('[data-testid="folder-Empty Folder"]').click();
        cy.get('[role="menu"]').should('contain.text', '(empty)');
    });
});
```

### 4. Accessibility Tests

```typescript
describe('Bookmarks Accessibility', () => {
    it('passes axe checks', () => {
        cy.visit('/test-team/channels/test-channel');
        cy.injectAxe();
        cy.checkA11y('[data-testid="bookmarks-bar"]');
    });

    it('overflow menu is keyboard accessible', () => {
        cy.get('[data-testid="overflow-menu-button"]')
            .should('have.attr', 'aria-haspopup', 'true')
            .should('have.attr', 'aria-expanded', 'false');

        cy.get('[data-testid="overflow-menu-button"]').focus().type('{enter}');

        cy.get('[data-testid="overflow-menu-button"]')
            .should('have.attr', 'aria-expanded', 'true');

        cy.get('[role="menu"]').should('have.attr', 'aria-labelledby');
    });

    it('announces drag operations', () => {
        // Start drag with keyboard
        cy.get('[data-testid="bookmark-item-1"]').focus().type(' '); // Space to grab

        cy.get('[aria-live="assertive"]')
            .should('contain.text', 'Picked up');

        cy.focused().type('{rightarrow}');

        cy.get('[aria-live="assertive"]')
            .should('contain.text', 'Moved to position');
    });
});
```

### 5. Performance Tests

```typescript
describe('Performance', () => {
    it('renders 50 bookmarks without jank', () => {
        // Create max bookmarks
        for (let i = 0; i < 50; i++) {
            cy.apiCreateChannelBookmark('test-channel', { display_name: `BM${i}` });
        }

        cy.visit('/test-team/channels/test-channel');

        // Measure render time
        cy.window().then((win) => {
            const entries = win.performance.getEntriesByType('measure');
            const bookmarksRender = entries.find(e => e.name === 'bookmarks-render');
            expect(bookmarksRender?.duration).to.be.lessThan(100); // <100ms
        });
    });

    it('handles rapid resize without lag', () => {
        cy.visit('/test-team/channels/test-channel');

        // Rapid resize
        for (let w = 1400; w >= 600; w -= 100) {
            cy.viewport(w, 800);
        }

        // Should not crash or show incorrect overflow count
        cy.get('[data-testid="overflow-menu-button"]').should('be.visible');
    });
});
```

### 6. Test Matrix

| Test Type | Phase 1 (DnD) | Phase 2 (Overflow) | Phase 3 (Cross-List) | Phase 4 (Folders) |
|-----------|---------------|--------------------|--------------------|-------------------|
| Unit | DnD hooks | Overflow calc | Cross-list handlers | Folder CRUD |
| Integration | Same-list drag | Bar + menu | Container moves | Folder drag targets |
| E2E | Reorder | Responsive | Full workflows | Folder workflows |
| A11y | Keyboard drag | Menu a11y | Screen reader | Folder navigation |
| Perf | Drag smoothness | Resize perf | Multi-container | Large folders |

---

## Rollout Strategy

### Feature Flags

```go
// server/public/model/feature_flags.go
ChannelBookmarksDndKit     bool `default:"false"` // Phase 1
ChannelBookmarksOverflow   bool `default:"false"` // Phase 2
ChannelBookmarksFolders    bool `default:"false"` // Phase 4
```

### Rollout Plan

| Phase | Flag | Audience | Duration | Success Criteria |
|-------|------|----------|----------|------------------|
| 1a | `ChannelBookmarksDndKit` | Internal | 1 week | No regressions |
| 1b | `ChannelBookmarksDndKit` | 5% users | 2 weeks | Error rate < 0.1% |
| 1c | `ChannelBookmarksDndKit` | 100% | Permanent | - |
| 2a | `ChannelBookmarksOverflow` | Internal | 1 week | UX feedback positive |
| 2b | `ChannelBookmarksOverflow` | 25% users | 2 weeks | No support tickets |
| 2c | `ChannelBookmarksOverflow` | 100% | Permanent | - |
| 4 | `ChannelBookmarksFolders` | TBD | TBD | - |

### Metrics to Track

- **Bookmarks per channel** - Average, median, p95
- **Overflow menu opens** - Frequency of accessing overflow
- **Cross-list drags** - How often users move between bar/overflow
- **Folder usage** - Adoption rate, items per folder
- **Error rates** - Reorder failures, DnD errors
- **Performance** - Render time, interaction latency

---

## Appendix

### A. Dependencies

```json
{
    "dependencies": {
        "@dnd-kit/core": "^6.1.0",
        "@dnd-kit/sortable": "^8.0.0",
        "@dnd-kit/utilities": "^3.2.2"
    },
    "devDependencies": {
        "@dnd-kit/accessibility": "^3.1.0"
    }
}
```

### B. Browser Support

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

### C. Related Documentation

- [dnd-kit Documentation](https://docs.dndkit.com/)
- [Mattermost Bookmarks API](./api/channel-bookmarks.md)
- [Figma Designs](https://www.figma.com/file/xxx/Channel-Bookmarks-Overflow)

### D. Open Questions

1. Should folders have a custom icon/color selection?
2. Maximum folder depth - 1 level or allow deeper nesting?
3. Folder sharing - can folders be copied between channels?
4. Mobile behavior - should overflow menu be different on touch devices?

### E. References

- [Jira: MM-56762](https://mattermost.atlassian.net/browse/MM-56762)
- [react-beautiful-dnd Deprecation](https://github.com/atlassian/react-beautiful-dnd/issues/2672)
- [dnd-kit vs pragmatic-drag-and-drop](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)
