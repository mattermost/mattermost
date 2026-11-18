// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';

type ComposerSubmenuHover = {
    activeRow: string | null;
    claimRow: (id: string | null) => void;
};

const ComposerSubmenuHoverContext = createContext<ComposerSubmenuHover>({
    activeRow: null,
    claimRow: () => {},
});

// Long enough to cross the gap between a row and its panel, short enough that
// a row the pointer has left does not stay open.
const SUBMENU_CLOSE_DELAY = 80;

// One hovered row in the composer + menu. A submenu stays open only while its
// row is the claimed one, so a fast move down the list closes the previous panel.
export function ComposerSubmenuHoverProvider({children}: {children: ReactNode}) {
    const [activeRow, setActiveRow] = useState<string | null>(null);
    const value = useMemo(() => ({
        activeRow,
        claimRow: setActiveRow,
    }), [activeRow]);

    return (
        <ComposerSubmenuHoverContext.Provider value={value}>
            {children}
        </ComposerSubmenuHoverContext.Provider>
    );
}

export function useComposerSubmenuHover() {
    return useContext(ComposerSubmenuHoverContext);
}

export const COMPOSER_PLUS_MENU_ID = 'agent-composer-menu';

export function pointerIsInside(node: EventTarget | null, root: HTMLElement | null) {
    return node instanceof Node && Boolean(root?.contains(node));
}

// Where the pointer went when it left a submenu row or its panel.
// `close` is another row in the + menu. `stay` is this panel or a menu it
// opened, such as the rewrite agent picker. `delay` is empty space, so the
// pointer may still be on its way into the panel.
export function submenuPointerDestination(
    next: EventTarget | null,
    panel: HTMLElement | null,
    anchor: HTMLElement | null,
): 'stay' | 'close' | 'delay' {
    if (pointerIsInside(next, panel) || pointerIsInside(next, anchor)) {
        return 'stay';
    }
    if (!(next instanceof Element)) {
        return 'delay';
    }

    const parentMenu = document.getElementById(COMPOSER_PLUS_MENU_ID);
    if (parentMenu?.contains(next) || parentMenu?.closest('.MuiPaper-root')?.contains(next)) {
        return 'close';
    }

    // A portaled menu that belongs to the open panel, not the + list.
    if (next.closest('[role="menu"], [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], .MuiPopover-paper')) {
        return 'stay';
    }

    return 'delay';
}

// Delay the close so the pointer can reach the panel. Callers cancel on panel
// enter, and close immediately when another row claims the hover.
export function useDelayedSubmenuClose(close: () => void) {
    const timer = useRef<number | null>(null);
    const closeRef = useRef(close);
    closeRef.current = close;

    const cancel = useCallback(() => {
        if (timer.current != null) {
            window.clearTimeout(timer.current);
            timer.current = null;
        }
    }, []);

    const schedule = useCallback(() => {
        cancel();
        timer.current = window.setTimeout(() => {
            timer.current = null;
            closeRef.current();
        }, SUBMENU_CLOSE_DELAY);
    }, [cancel]);

    useEffect(() => cancel, [cancel]);

    return {cancel, schedule};
}
