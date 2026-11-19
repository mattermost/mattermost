// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PopoverOrigin} from '@mui/material/Popover';
import {useCallback, useLayoutEffect, useRef, useState} from 'react';

// Keeps the host popover mounted while Compass plays its scale-and-fade exit.
// `open` is the logical state passed to PopoverMenu. `present` is whether the
// host should still be in the tree.
export function useCompassMenuPresence(open: boolean) {
    const [present, setPresent] = useState(open);
    if (open && !present) {
        setPresent(true);
    }

    const onExited = useCallback(() => {
        setPresent(false);
    }, []);

    return {present: open || present, onExited};
}

// The corner of the menu that stays against the trigger while it scales.
export function compassSurfaceOriginClass(transformOrigin: PopoverOrigin): string {
    const vertical = transformOrigin.vertical === 'bottom' ? 'bottom' : 'top';
    const horizontal = transformOrigin.horizontal === 'right' ? 'right' : 'left';
    return `menu_menuStyled__surface--origin-${vertical}-${horizontal}`;
}

export type SubmenuSide = {
    x: 'right' | 'left';
    y: 'down' | 'up';
};

// Distance from `element`'s border edge to `parent`'s padding edge. The parent
// is the anchor's offset parent (the menu list), which is also its containing
// block, so this is the top used to line the child up with the row.
function topWithin(element: HTMLElement, parent: HTMLElement): number | null {
    let top = 0;
    let current: HTMLElement | null = element;
    while (current && current !== parent) {
        top += current.offsetTop;
        const next = current.offsetParent as HTMLElement | null;
        if (!next) {
            return null;
        }
        current = next;
    }
    return current === parent ? top : null;
}

// Compass child menus open to the right of the row and grow downward. Each
// axis flips once, when that side leaves the viewport, and stays there. The
// child is measured from the in-flow anchor beside the row (getBoundingClientRect).
export function useSubmenuSide(open: boolean, submenuId: string | null, row: HTMLElement | null) {
    const anchorRef = useRef<HTMLDivElement | null>(null);
    const [side, setSide] = useState<SubmenuSide>({x: 'right', y: 'down'});

    // Start each opening on the right, growing down. Keep a flipped side through
    // the close animation so the menu does not jump while it fades out.
    const openedFor = useRef<string | null>(null);
    if (!open) {
        openedFor.current = null;
    } else if (submenuId && openedFor.current !== submenuId) {
        openedFor.current = submenuId;
        if (side.x !== 'right' || side.y !== 'down') {
            setSide({x: 'right', y: 'down'});
        }
    }

    useLayoutEffect(() => {
        if (!open) {
            return;
        }
        const anchor = anchorRef.current;
        if (!anchor) {
            return;
        }

        // The anchor is the row's sibling, so the menu list is the containing
        // block. Shift it by the row's position; the stylesheet then overlaps
        // that by --spacing-xs and leaves a --spacing-xxs gap past the menu.
        const parent = anchor.offsetParent as HTMLElement | null;
        if (parent && row) {
            const rowTop = topWithin(row, parent);
            if (rowTop != null) {
                const rowBottom = parent.clientHeight - (rowTop + row.offsetHeight);
                anchor.style.setProperty('--menu-submenu-row-top', `${rowTop}px`);
                anchor.style.setProperty('--menu-submenu-row-bottom', `${rowBottom}px`);
            }
        }

        const rect = anchor.getBoundingClientRect();
        setSide((prev) => {
            const next: SubmenuSide = {
                x: prev.x === 'right' && rect.right > window.innerWidth ? 'left' : prev.x,
                y: prev.y === 'down' && rect.bottom > window.innerHeight ? 'up' : prev.y,
            };
            if (next.x === prev.x && next.y === prev.y) {
                return prev;
            }
            return next;
        });
    }, [open, row, side, submenuId]);

    // The corner nearest the row, so the child scales out from that edge.
    const transformOrigin: PopoverOrigin = {
        vertical: side.y === 'down' ? 'top' : 'bottom',
        horizontal: side.x === 'right' ? 'left' : 'right',
    };

    return {side, transformOrigin, anchorRef};
}
