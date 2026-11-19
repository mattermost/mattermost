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

// Compass child menus open to the right of the row and grow downward. Each
// axis flips when that side would leave the viewport. The child overlaps the
// row by the parent menu's padding, with a small gap past the parent's edge.
export function useSubmenuSide(open: boolean, anchor: HTMLElement | null) {
    const [side, setSide] = useState<SubmenuSide>({x: 'right', y: 'down'});
    const [paper, setPaper] = useState<HTMLDivElement | null>(null);

    // Start each opening on the right, growing down. Keep a flipped side through
    // the close animation so the menu does not jump while it fades out.
    const wasOpen = useRef(false);
    if (open && !wasOpen.current && (side.x !== 'right' || side.y !== 'down')) {
        setSide({x: 'right', y: 'down'});
    }
    wasOpen.current = open;

    useLayoutEffect(() => {
        if (!open || !paper || !anchor) {
            return;
        }
        const rect = paper.getBoundingClientRect();
        const margin = 8;
        setSide((prev) => {
            const next: SubmenuSide = {
                x: prev.x === 'right' && rect.right > window.innerWidth - margin ? 'left' : prev.x,
                y: prev.y === 'down' && rect.bottom > window.innerHeight - margin ? 'up' : prev.y,
            };
            if (next.x === prev.x && next.y === prev.y) {
                return prev;
            }
            return next;
        });
    }, [anchor, open, paper, side]);

    const anchorOrigin: PopoverOrigin = {
        vertical: side.y === 'down' ? 'top' : 'bottom',
        horizontal: side.x === 'right' ? 'right' : 'left',
    };
    const transformOrigin: PopoverOrigin = {
        vertical: side.y === 'down' ? 'top' : 'bottom',
        horizontal: side.x === 'right' ? 'left' : 'right',
    };

    return {side, anchorOrigin, transformOrigin, setPaper};
}

export function compassSubmenuClass(side: SubmenuSide): string {
    return [
        side.x === 'right' ? 'menu_menuStyled--side-right' : 'menu_menuStyled--side-left',
        side.y === 'down' ? 'menu_menuStyled--overlap-down' : 'menu_menuStyled--overlap-up',
    ].join(' ');
}
