// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';

import {MenuContext, useMenuContextValue} from './menu_context';

type Props = {
    children: React.ReactNode;
}

export function WithTestMenuContext({
    children,
}: Props) {
    const [show, setShow] = useState(true);
    const menuContextValue = useMenuContextValue(() => setShow(false), show);

    useEffect(() => {
        if (!show) {
            menuContextValue.handleClosed();
        }

        // We only want to call this when the menu is closed
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]);

    return (
        <MenuContext.Provider value={menuContextValue}>
            {children}
        </MenuContext.Provider>
    );
}
