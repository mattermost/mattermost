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

export function pointerIsInside(node: EventTarget | null, root: HTMLElement | null) {
    return node instanceof Node && Boolean(root?.contains(node));
}

export function isMenuRowTarget(node: EventTarget | null) {
    return node instanceof Element && Boolean(node.closest('[role="menuitem"]'));
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
