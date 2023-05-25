// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import type {GlobalState} from 'types/store';

declare global {
    interface Window {
        basename: string;
    }
}

export function getBasePath(state: GlobalState) {
    const config = getConfig(state) || {};

    if (config.SiteURL) {
        return new URL(config.SiteURL).pathname;
    }

    return window.basename || '/';
}

export function getConnectionId(state: GlobalState) {
    return state.websocket.connectionId;
}

export function isDevModeEnabled(state: GlobalState) {
    const config = getConfig(state);
    const EnableDeveloper = config && config.EnableDeveloper ? config.EnableDeveloper === 'true' : false;
    return EnableDeveloper;
}
