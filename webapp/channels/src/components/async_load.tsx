// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

export function makeAsyncComponent<ComponentProps>(displayName: string, LazyComponent: React.ComponentType<ComponentProps>, fallback: React.ReactNode = null) {
    const Component = (props: ComponentProps) => (
        <React.Suspense fallback={fallback}>
            <LazyComponent {...props}/>
        </React.Suspense>
    );
    Component.displayName = displayName;
    return Component;
}
