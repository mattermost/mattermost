// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {lazy, type ComponentType} from 'react';

import type {PluggableComponentType, PluggableProps} from 'plugins/pluggable/pluggable';

import type {PluginsState, ProductSubComponentNames} from 'types/store/plugins';

export function makeAsyncComponent<ComponentProps>(displayName: string, LazyComponent: React.ComponentType<ComponentProps>, fallback: React.ReactNode = null) {
    const Component: ComponentType<ComponentProps> = (props) => (
        <React.Suspense fallback={fallback}>
            <LazyComponent {...props}/>
        </React.Suspense>
    );
    Component.displayName = displayName;
    return Component;
}

export function makeAsyncPluggableComponent() {
    const LazyComponent = lazy(() => import('plugins/pluggable')) as PluggableComponentType;

    const Component = <T extends keyof PluginsState['components'], U extends ProductSubComponentNames>(props: PluggableProps<T, U>) => (
        <React.Suspense fallback={null}>
            <LazyComponent<T, U> {...props}/>
        </React.Suspense>
    );

    Component.displayName = 'Pluggable';

    return Component;
}
