// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';

/* eslint-disable no-underscore-dangle */

export interface SharedContextValue {
}

declare global {
    interface Window {
        __MATTERMOST_SHARED_CONTEXT__: React.Context<SharedContextValue> | undefined;
    }
}

// If multiple copies of the shared package happen to be loaded, this makes them share the same context. In practice,
// // this should never happen because the web app is supposed to provide the only copy of @mattermost/shared,
// but I borrowed the idea from React Intl.
export const SharedContext = window?.__MATTERMOST_SHARED_CONTEXT__ ?? (
    window.__MATTERMOST_SHARED_CONTEXT__ = React.createContext<SharedContextValue>(
        null as unknown as SharedContextValue,
    )
);
SharedContext.displayName = 'MattermostSharedContext';

export interface SharedProviderProps {
    children?: React.ReactNode;
}

export function SharedProvider({
    children,
}: SharedProviderProps) {
    const contextValue = useMemo(() => ({
    }), []);

    return <SharedContext.Provider value={contextValue}>{children}</SharedContext.Provider>;
}
