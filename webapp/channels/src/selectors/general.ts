// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createSelector} from 'reselect';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getTimezoneForUserProfile} from 'mattermost-redux/selectors/entities/timezone';

import * as UserAgent from 'utils/user_agent';

import type {GlobalState} from 'types/store';

declare global {
    interface Window {
        basename: string;
    }
}

export function areTimezonesEnabledAndSupported(state: GlobalState) {
    if (UserAgent.isInternetExplorer()) {
        return false;
    }

    const config = getConfig(state);
    return config.ExperimentalTimezone === 'true';
}

export function getBasePath(state: GlobalState) {
    const config = getConfig(state) || {};

    if (config.SiteURL) {
        return new URL(config.SiteURL).pathname;
    }

    return window.basename || '/';
}

export const getCurrentUserTimezone = createSelector(
    'getCurrentUserTimezone',
    getCurrentUser,
    areTimezonesEnabledAndSupported,
    (user, enabledTimezone) => {
        let timezone;
        if (enabledTimezone) {
            const userTimezone = getTimezoneForUserProfile(user);
            timezone = userTimezone.useAutomaticTimezone ? userTimezone.automaticTimezone : userTimezone.manualTimezone;
        }

        return timezone;
    },
);

export function getConnectionId(state: GlobalState) {
    return state.websocket.connectionId;
}

export function isDevModeEnabled(state: GlobalState) {
    const config = getConfig(state);
    const EnableDeveloper = config && config.EnableDeveloper ? config.EnableDeveloper === 'true' : false;
    return EnableDeveloper;
}
