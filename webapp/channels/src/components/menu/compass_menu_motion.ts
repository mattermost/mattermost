// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PopoverOrigin} from '@mui/material/Popover';
import {useCallback, useState} from 'react';

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

// Side menus sit beside a row. The class adds the 4px gap on that side.
export function compassSideClass(anchorOrigin: PopoverOrigin, transformOrigin: PopoverOrigin): string | undefined {
    if (anchorOrigin.horizontal === 'right' && transformOrigin.horizontal === 'left') {
        return 'menu_menuStyled--side-right';
    }
    if (anchorOrigin.horizontal === 'left' && transformOrigin.horizontal === 'right') {
        return 'menu_menuStyled--side-left';
    }
    return undefined;
}
