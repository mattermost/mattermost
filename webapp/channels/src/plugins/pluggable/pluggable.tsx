// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

import webSocketClient from 'client/web_websocket_client';

import type {GlobalState} from 'types/store';
import type {PluginsState, ProductComponent, ProductSubComponentNames} from 'types/store/plugins';

import PluggableErrorBoundary from './error_boundary';

type ComponentProps<
    Key extends keyof PluginsState['components'],
    SubKey extends ProductSubComponentNames,
> = Key extends 'Product' ?
    (PluginsState['components'][Key][number][SubKey] extends React.ComponentType<any> ? React.ComponentProps<PluginsState['components'][Key][number][SubKey]> : never) :
    (PluginsState['components'][Key][number] extends {component: React.ComponentType<any>} ? React.ComponentProps<PluginsState['components'][Key][number]['component']> : never);
type WrapperProps<T extends keyof PluginsState['components'], U extends ProductSubComponentNames> = {

    /*
     * Override the component to be plugged
     */
    pluggableName: T;

    /*
     * Id of the specific component to be plugged.
     */
    pluggableId?: string;

    /*
     * Name of the sub component to use. Defaults to 'component' if unspecified.
     *
     * Only supported when pluggableName is "Product".
     */
    subComponentName?: U;
}

export type PluggableProps<Key extends keyof PluginsState['components'], SubKey extends ProductSubComponentNames> = WrapperProps<Key, SubKey> & Omit<ComponentProps<Key, SubKey>, keyof WrapperProps<Key, SubKey> | 'theme' | (Key extends 'Product' ? never : 'webSocketClient')>

export default function Pluggable<Key extends keyof PluginsState['components'], SubKey extends ProductSubComponentNames>(props: PluggableProps<Key, SubKey>) {
    const {
        pluggableId,
        pluggableName,
        subComponentName = '',
        ...otherProps
    } = props;

    type PluggableType = PluginsState['components'][Key][number];
    const theme = useSelector(getTheme);
    const allPluginComponents = useSelector((state: GlobalState) => {
        const allComponents = state.plugins.components;
        if (Object.hasOwn(allComponents, pluggableName)) {
            return allComponents[pluggableName] as PluggableType[];
        }
        return undefined;
    });
    if (!pluggableName || !allPluginComponents) {
        return null;
    }

    let pluginComponents: PluggableType[] = [...allPluginComponents];
    if (pluggableId) {
        pluginComponents = pluginComponents.filter(
            (element) => element.id === pluggableId);
    }

    // Override the default component with any registered plugin's component
    // Select a specific component by pluginId if available
    let content;

    if (pluggableName === 'Product') {
        const productComponents = pluginComponents as ProductComponent[];
        content = (productComponents).map((pc) => {
            if (!subComponentName || !pc[subComponentName]) {
                return null;
            }

            // The function arguments typing makes sure the passed props are
            // correct, so it is safe to cast here.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Component = pc[subComponentName] as React.ComponentType<any>;

            return (
                <PluggableErrorBoundary
                    key={pluggableName + pc.id}
                    pluginId={pc.pluginId}
                >
                    <Component
                        {...otherProps}
                        theme={theme}
                    />
                </PluggableErrorBoundary>
            );
        });
    } else {
        content = pluginComponents.map((p) => {
            if (!('component' in p) || !p.component) {
                return null;
            }

            // The function arguments typing makes sure the passed props are
            // correct, so it is safe to cast here.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Component = p.component as React.ComponentType<any>;

            return (
                <PluggableErrorBoundary
                    key={pluggableName + p.id}
                    pluginId={p.pluginId}
                >
                    <Component
                        {...otherProps}
                        theme={theme}
                        webSocketClient={webSocketClient}
                    />
                </PluggableErrorBoundary>
            );
        });
    }

    return (
        <>
            {content}
        </>
    );
}

export type PluggableComponentType = typeof Pluggable;
