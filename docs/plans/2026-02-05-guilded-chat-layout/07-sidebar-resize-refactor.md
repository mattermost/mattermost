# 07 - Sidebar Resize Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the janky CSS-variable-based sidebar resizing with a smooth, reliable inline-style approach that persists widths correctly.

**Architecture:** Direct inline `width` styles instead of CSS variables. Track intended width in React state (not `getBoundingClientRect()`). Remove CSS max-width constraints that fight with resize values. Single `useResizable` hook handles all resize logic for both sidebars.

**Tech Stack:** React hooks, Redux (useGlobalState for persistence), TypeScript, SCSS, styled-components

**Depends on:** 01-feature-flag-and-infrastructure.md

---

## Current Problems

1. **CSS variables + max-width fight** - Setting `--overrideLhsWidth: 400px` does nothing when `max-width: 264px` clamps it
2. **Wrong value persisted** - `getBoundingClientRect()` returns clamped width, not intended width
3. **Race condition** - Inline style removed before global style re-renders
4. **Inconsistent LHS/RHS** - Different code paths, different bugs
5. **Over-engineered snap logic** - Complex, hard to debug

---

## Task 1: Create useResizable Hook

**Files:**
- Create: `webapp/channels/src/components/resizable_sidebar/use_resizable.ts`

**Step 1: Create the hook**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback, useEffect, useRef, useState} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {useGlobalState} from 'stores/hooks';

export interface UseResizableOptions {
    name: string;
    defaultWidth: number;
    minWidth: number;
    maxWidth: number;
    direction: 'left' | 'right';
}

export interface UseResizableReturn {
    width: number;
    isResizing: boolean;
    containerStyle: React.CSSProperties;
    dividerProps: {
        onMouseDown: (e: React.MouseEvent) => void;
        onDoubleClick: () => void;
    };
    reset: () => void;
}

export function useResizable({
    name,
    defaultWidth,
    minWidth,
    maxWidth,
    direction,
}: UseResizableOptions): UseResizableReturn {
    const currentUserId = useSelector(getCurrentUserId);

    // Persisted width (null = use default)
    const [savedWidth, setSavedWidth] = useGlobalState<number | null>(
        null,
        `sidebar_width_${name}:`,
        currentUserId,
    );

    // Current width during resize (null = use saved or default)
    const [activeWidth, setActiveWidth] = useState<number | null>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Refs for tracking drag state
    const startX = useRef(0);
    const startWidth = useRef(0);

    // Computed current width
    const width = activeWidth ?? savedWidth ?? defaultWidth;

    // Clamp width to bounds
    const clampWidth = useCallback((w: number) => {
        return Math.max(minWidth, Math.min(maxWidth, w));
    }, [minWidth, maxWidth]);

    // Mouse handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        startX.current = e.clientX;
        startWidth.current = width;
        setIsResizing(true);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, [width]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isResizing) {
            return;
        }

        const delta = direction === 'left'
            ? e.clientX - startX.current
            : startX.current - e.clientX;

        const newWidth = clampWidth(startWidth.current + delta);
        setActiveWidth(newWidth);
    }, [isResizing, direction, clampWidth]);

    const handleMouseUp = useCallback(() => {
        if (!isResizing) {
            return;
        }

        // Persist the current width
        if (activeWidth !== null) {
            setSavedWidth(activeWidth);
        }

        setActiveWidth(null);
        setIsResizing(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, [isResizing, activeWidth, setSavedWidth]);

    // Double-click to reset
    const reset = useCallback(() => {
        setSavedWidth(null);
        setActiveWidth(null);
    }, [setSavedWidth]);

    // Attach/detach global listeners
    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
        return undefined;
    }, [isResizing, handleMouseMove, handleMouseUp]);

    return {
        width,
        isResizing,
        containerStyle: {
            width: `${width}px`,
            minWidth: `${minWidth}px`,
            maxWidth: `${maxWidth}px`,
        },
        dividerProps: {
            onMouseDown: handleMouseDown,
            onDoubleClick: reset,
        },
        reset,
    };
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/resizable_sidebar/use_resizable.ts
git commit -m "feat: add useResizable hook for sidebar width management"
```

---

## Task 2: Create ResizeDivider Component

**Files:**
- Create: `webapp/channels/src/components/resizable_sidebar/resize_divider.tsx`

**Step 1: Create the divider component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

interface DividerContainerProps {
    $position: 'left' | 'right';
    $isResizing: boolean;
}

const DividerContainer = styled.div<DividerContainerProps>`
    position: absolute;
    top: 0;
    ${({$position}) => $position === 'left' ? 'right: -6px;' : 'left: -6px;'}
    width: 12px;
    height: 100%;
    cursor: col-resize;
    z-index: 50;

    &::after {
        content: '';
        position: absolute;
        top: 0;
        left: 4px;
        width: 4px;
        height: 100%;
        background-color: ${({$isResizing}) =>
            $isResizing ? 'var(--sidebar-text-active-border)' : 'transparent'};
        transition: background-color 150ms ease;
    }

    &:hover::after {
        background-color: var(--sidebar-text-active-border);
    }
`;

interface ResizeDividerProps {
    position: 'left' | 'right';
    isResizing: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onDoubleClick: () => void;
}

export function ResizeDivider({
    position,
    isResizing,
    onMouseDown,
    onDoubleClick,
}: ResizeDividerProps) {
    return (
        <DividerContainer
            $position={position}
            $isResizing={isResizing}
            onMouseDown={onMouseDown}
            onDoubleClick={onDoubleClick}
        />
    );
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/resizable_sidebar/resize_divider.tsx
git commit -m "feat: add ResizeDivider styled component"
```

---

## Task 3: Create ResizableSidebar Wrapper Component

**Files:**
- Create: `webapp/channels/src/components/resizable_sidebar/resizable_sidebar.tsx`

**Step 1: Create the wrapper component**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import {ResizeDivider} from './resize_divider';
import type {UseResizableReturn} from './use_resizable';

interface ContainerProps {
    $isResizing: boolean;
}

const Container = styled.div<ContainerProps>`
    position: relative;
    height: 100%;
    transition: ${({$isResizing}) => $isResizing ? 'none' : 'width 150ms ease'};
`;

interface ResizableSidebarProps {
    children: React.ReactNode;
    id?: string;
    className?: string;
    resizable: UseResizableReturn;
    dividerPosition: 'left' | 'right';
    role?: string;
    ariaLabel?: string;
}

export function ResizableSidebar({
    children,
    id,
    className,
    resizable,
    dividerPosition,
    role,
    ariaLabel,
}: ResizableSidebarProps) {
    return (
        <Container
            id={id}
            className={className}
            role={role}
            aria-label={ariaLabel}
            style={resizable.containerStyle}
            $isResizing={resizable.isResizing}
        >
            {children}
            <ResizeDivider
                position={dividerPosition}
                isResizing={resizable.isResizing}
                onMouseDown={resizable.dividerProps.onMouseDown}
                onDoubleClick={resizable.dividerProps.onDoubleClick}
            />
        </Container>
    );
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/resizable_sidebar/resizable_sidebar.tsx
git commit -m "feat: add ResizableSidebar wrapper component"
```

---

## Task 4: Update Constants with New Defaults

**Files:**
- Modify: `webapp/channels/src/components/resizable_sidebar/constants.ts`

**Step 1: Add LHS and update RHS constants**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export enum SidebarSize {
    SMALL = 'small',
    MEDIUM = 'medium',
    LARGE = 'large',
    XLARGE = 'xlarge',
}

// LHS Constants
export const DEFAULT_LHS_WIDTH = 240;
export const MIN_LHS_WIDTH = 200;
export const MAX_LHS_WIDTH = 420;

// RHS Constants by viewport size
export const RHS_MIN_MAX_WIDTH: {[size in SidebarSize]: {min: number; max: number; default: number}} = {
    [SidebarSize.SMALL]: {
        min: 300,
        max: 500,
        default: 360,
    },
    [SidebarSize.MEDIUM]: {
        min: 300,
        max: 600,
        default: 400,
    },
    [SidebarSize.LARGE]: {
        min: 300,
        max: 700,
        default: 400,
    },
    [SidebarSize.XLARGE]: {
        min: 300,
        max: 900,
        default: 500,
    },
};

// Team sidebar (fixed width in collapsed state)
export const TEAM_SIDEBAR_WIDTH = 72;
export const TEAM_SIDEBAR_EXPANDED_WIDTH = 240;
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/resizable_sidebar/constants.ts
git commit -m "feat: update sidebar width constants for free resizing"
```

---

## Task 5: Update ResizableLhs to Use New Architecture

**Files:**
- Modify: `webapp/channels/src/components/resizable_sidebar/resizable_lhs/index.tsx`

**Step 1: Replace implementation**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HTMLAttributes} from 'react';
import React from 'react';

import {DEFAULT_LHS_WIDTH, MIN_LHS_WIDTH, MAX_LHS_WIDTH} from '../constants';
import {ResizableSidebar} from '../resizable_sidebar';
import {useResizable} from '../use_resizable';

interface Props extends HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

function ResizableLhs({
    children,
    id,
    className,
}: Props) {
    const resizable = useResizable({
        name: 'lhs',
        defaultWidth: DEFAULT_LHS_WIDTH,
        minWidth: MIN_LHS_WIDTH,
        maxWidth: MAX_LHS_WIDTH,
        direction: 'left',
    });

    return (
        <ResizableSidebar
            id={id}
            className={className}
            resizable={resizable}
            dividerPosition='left'
        >
            {children}
        </ResizableSidebar>
    );
}

export default ResizableLhs;
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/resizable_sidebar/resizable_lhs/index.tsx
git commit -m "refactor: update ResizableLhs to use new resize architecture"
```

---

## Task 6: Update ResizableRhs to Use New Architecture

**Files:**
- Modify: `webapp/channels/src/components/resizable_sidebar/resizable_rhs/index.tsx`

**Step 1: Replace implementation**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {HTMLAttributes} from 'react';
import React from 'react';
import {useSelector} from 'react-redux';

import {getIsRhsExpanded, getRhsSize} from 'selectors/rhs';

import {RHS_MIN_MAX_WIDTH} from '../constants';
import {ResizableSidebar} from '../resizable_sidebar';
import {useResizable} from '../use_resizable';

interface Props extends HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    rightWidthHolderRef?: React.RefObject<HTMLDivElement>;
    ariaLabel?: string;
}

function ResizableRhs({
    role,
    children,
    id,
    className,
    ariaLabel,
}: Props) {
    const rhsSize = useSelector(getRhsSize);
    const isRhsExpanded = useSelector(getIsRhsExpanded);

    const {min, max, default: defaultWidth} = RHS_MIN_MAX_WIDTH[rhsSize];

    const resizable = useResizable({
        name: 'rhs',
        defaultWidth,
        minWidth: min,
        maxWidth: max,
        direction: 'right',
    });

    // When expanded, use full width
    const containerStyle = isRhsExpanded
        ? {width: '100%', minWidth: undefined, maxWidth: undefined}
        : resizable.containerStyle;

    return (
        <ResizableSidebar
            id={id}
            className={className}
            role={role}
            ariaLabel={ariaLabel}
            resizable={{
                ...resizable,
                containerStyle,
            }}
            dividerPosition='right'
        >
            {children}
        </ResizableSidebar>
    );
}

export default ResizableRhs;
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/resizable_sidebar/resizable_rhs/index.tsx
git commit -m "refactor: update ResizableRhs to use new resize architecture"
```

---

## Task 7: Remove CSS max-width Constraints from LHS

**Files:**
- Modify: `webapp/channels/src/sass/layout/_sidebar-left.scss`

**Step 1: Update the CSS to remove hardcoded constraints**

Find the `#SidebarContainer` rules and update:

```scss
#SidebarContainer {
    position: relative;
    z-index: 16;
    left: 0;
    display: flex;
    height: 100%;
    min-height: 0;
    flex-direction: column;
    background-color: var(--sidebar-bg);
    overflow-x: visible;

    // Mobile: fixed width
    @media screen and (max-width: 768px) {
        min-width: 240px;
        max-width: 240px;
    }

    // Desktop: width controlled by inline styles from JS
    @media screen and (min-width: 769px) {
        min-width: 200px;
        max-width: none; // Allow JS to control width
        background: none;
    }
}
```

**Step 2: Remove CSS variable width overrides if present**

Remove any `width: var(--overrideLhsWidth)` rules that conflict with inline styles.

**Step 3: Commit**

```bash
git add webapp/channels/src/sass/layout/_sidebar-left.scss
git commit -m "fix: remove hardcoded max-width constraints from LHS sidebar"
```

---

## Task 8: Remove CSS max-width Constraints from RHS

**Files:**
- Modify: `webapp/channels/src/sass/layout/_sidebar-right.scss`

**Step 1: Update the CSS to remove hardcoded constraints**

```scss
.sidebar--right {
    // Width controlled by inline styles from JS
    // Only set min-width for safety

    &:not(.expanded) {
        min-width: 300px;

        @media screen and (max-width: 400px) {
            min-width: unset;
        }

        // Remove max-width constraints - JS controls this now
    }

    height: 100%;
    padding: 0;
    transform: translateX(100%);

    // ... rest of file unchanged ...
}

.sidebar--right--width-holder {
    @media screen and (max-width: 768px) {
        display: none;
    }

    body:not(.layout-changing) & {
        transition: width 0.25s 0s ease-in, z-index 0.25s 0s step-end;
    }

    // Width controlled by inline styles from JS
    min-width: 300px;
}
```

**Step 2: Commit**

```bash
git add webapp/channels/src/sass/layout/_sidebar-right.scss
git commit -m "fix: remove hardcoded max-width constraints from RHS sidebar"
```

---

## Task 9: Clean Up Old Resize Files

**Files:**
- Remove or refactor: `webapp/channels/src/components/resizable_sidebar/resizable_divider.tsx`
- Remove or refactor: `webapp/channels/src/components/resizable_sidebar/utils.ts`

**Step 1: Remove old divider component if it exists**

If there's an old `resizable_divider.tsx` that's no longer used:

```bash
git rm webapp/channels/src/components/resizable_sidebar/resizable_divider.tsx
```

**Step 2: Remove old utils if no longer needed**

If `utils.ts` contains only snap logic that's no longer used:

```bash
git rm webapp/channels/src/components/resizable_sidebar/utils.ts
```

**Step 3: Commit**

```bash
git commit -m "chore: remove old resizable_divider and utils files"
```

---

## Task 10: Update Index Exports

**Files:**
- Modify: `webapp/channels/src/components/resizable_sidebar/index.ts`

**Step 1: Create clean exports**

```typescript
// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export {useResizable} from './use_resizable';
export type {UseResizableOptions, UseResizableReturn} from './use_resizable';
export {ResizableSidebar} from './resizable_sidebar';
export {ResizeDivider} from './resize_divider';
export {
    DEFAULT_LHS_WIDTH,
    MIN_LHS_WIDTH,
    MAX_LHS_WIDTH,
    RHS_MIN_MAX_WIDTH,
    SidebarSize,
    TEAM_SIDEBAR_WIDTH,
    TEAM_SIDEBAR_EXPANDED_WIDTH,
} from './constants';

// Re-export the wrapper components for backwards compatibility
export {default as ResizableLhs} from './resizable_lhs';
export {default as ResizableRhs} from './resizable_rhs';
```

**Step 2: Commit**

```bash
git add webapp/channels/src/components/resizable_sidebar/index.ts
git commit -m "chore: update resizable_sidebar exports"
```

---

## Task 11: Test Locally

**Step 1: Build the webapp**

```bash
cd webapp && npm run build
```

**Step 2: Start local test environment**

```bash
cd .. && ./local-test.ps1 build && ./local-test.ps1 start
```

**Step 3: Manual testing checklist**

- [ ] LHS sidebar can be resized by dragging the divider
- [ ] LHS width persists after page refresh
- [ ] LHS double-click resets to default width
- [ ] RHS sidebar can be resized by dragging the divider
- [ ] RHS width persists after page refresh
- [ ] RHS double-click resets to default width
- [ ] Resizing feels smooth with no jumping
- [ ] Width bounds are respected (can't go below min or above max)
- [ ] No CSS clamping issues (width actually changes)

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in manual testing"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | use_resizable.ts | Core resize hook |
| 2 | resize_divider.tsx | Styled divider component |
| 3 | resizable_sidebar.tsx | Wrapper component |
| 4 | constants.ts | Width constants |
| 5 | resizable_lhs/index.tsx | Update LHS to use new hook |
| 6 | resizable_rhs/index.tsx | Update RHS to use new hook |
| 7 | _sidebar-left.scss | Remove CSS constraints |
| 8 | _sidebar-right.scss | Remove CSS constraints |
| 9 | Various | Clean up old files |
| 10 | index.ts | Update exports |
| 11 | - | Manual testing |

**Next:** [08-integration-and-polish.md](./08-integration-and-polish.md)
