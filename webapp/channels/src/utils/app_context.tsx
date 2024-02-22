// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useContext, useMemo} from 'react';

export const AppContext = React.createContext(['root']);

type AppContextProps = {
    name: string;
    children: React.ReactNode;
}

export function AppContextBoundary(props: AppContextProps) {
    const parentContext = useContext(AppContext);

    const context = useMemo(() => [...parentContext, props.name], [parentContext, props.name]);

    return (
        <AppContext.Provider value={context}>
            {props.children}
        </AppContext.Provider>
    );
}
