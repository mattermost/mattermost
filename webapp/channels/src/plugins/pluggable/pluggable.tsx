// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {WebSocketClient} from '@mattermost/client';
import React from 'react';

import {Theme} from 'mattermost-redux/selectors/entities/preferences';

import webSocketClient from 'client/web_websocket_client';
import {GlobalState} from 'types/store';
import {ProductComponent} from 'types/store/plugins';

import PluggableErrorBoundary from './error_boundary';

type Props = {

    /*
     * Override the component to be plugged
     */
    pluggableName: string;

    /*
     * Components for overriding provided by plugins
     */
    components: GlobalState['plugins']['components'];

    /*
     * Logged in user's theme
     */
    theme: Theme;

    /*
     * Id of the specific component to be plugged.
     */
    pluggableId?: string;

    /*
     * Name of the sub component to use. Defaults to 'component' if unspecified.
     *
     * Only supported when pluggableName is "Product".
     */
    subComponentName?: 'mainComponent' | 'publicComponent' | 'headerCentreComponent' | 'headerRightComponent';

    /*
     * Accept any other prop to pass onto the plugin component
     */
    [name: string]: any;
}

type BaseChildProps = {
    theme: Theme;
    webSocketClient?: WebSocketClient;
}

export default function Pluggable(props: Props): JSX.Element | null {
    const {
        components,
        pluggableId,
        pluggableName,
        subComponentName = '',
        theme,
        ...otherProps
    } = props;

    if (!pluggableName || !Object.hasOwnProperty.call(components, pluggableName)) {
        return null;
    }

    let pluginComponents = components[pluggableName]!;

    if (pluggableId) {
        pluginComponents = pluginComponents.filter(
            (element) => element.id === pluggableId);
    }

    // Override the default component with any registered plugin's component
    // Select a specific component by pluginId if available
    let content;

    if (pluggableName === 'Product') {
        content = (pluginComponents as ProductComponent[]).map((pc) => {
            if (!subComponentName || !pc[subComponentName]) {
                return null;
            }

            const Component = pc[subComponentName]! as React.ComponentType<BaseChildProps>;

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
            if (!p.component) {
                return null;
            }

            const Component = p.component as React.ComponentType<BaseChildProps>;

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
        <React.Fragment>
            {content}
        </React.Fragment>
    );
}
