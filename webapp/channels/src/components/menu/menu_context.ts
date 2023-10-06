// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createContext, useMemo, useRef} from 'react';

interface MenuSubmenuContextType {
    close?: () => void;
    isOpen: boolean;
    addOnClosedListener: (listener: () => void) => void;
    handleClosed: () => void;
}

export const MenuContext = createContext<MenuSubmenuContextType>({
    isOpen: false,
    addOnClosedListener: () => {},
    handleClosed: () => {},
});
MenuContext.displayName = 'MenuContext';

export const SubMenuContext = createContext<MenuSubmenuContextType>({
    isOpen: false,
    addOnClosedListener: () => {},
    handleClosed: () => {},
});
SubMenuContext.displayName = 'SubMenuContext';

export function useMenuContextValue(close: () => void, isOpen: boolean): MenuSubmenuContextType {
    const onClosedListeners = useRef(new Set<() => void>());

    return useMemo(() => ({
        close,
        isOpen,
        addOnClosedListener: (listener: () => void) => {
            onClosedListeners.current.add(listener);
        },
        handleClosed: () => {
            onClosedListeners.current.forEach((listener) => listener());
            onClosedListeners.current.clear();
        },
    }), [close, isOpen]);
}
