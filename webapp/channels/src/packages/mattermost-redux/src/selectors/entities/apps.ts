// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppBinding} from '@mattermost/types/apps';
import type {ClientConfig} from '@mattermost/types/config';
import type {GlobalState} from '@mattermost/types/store';

import {AppBindingLocations} from 'mattermost-redux/constants/apps';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

export const appsPluginIsEnabled = (state: GlobalState) => state.entities.apps.pluginEnabled;

export const appsFeatureFlagEnabled = createSelector(
    'appsConfiguredAsEnabled',
    (state: GlobalState) => getConfig(state),
    (config: Partial<ClientConfig>) => {
        return config?.['FeatureFlagAppsEnabled' as keyof Partial<ClientConfig>] === 'true';
    },
);

export const appsEnabled = createSelector(
    'appsEnabled',
    appsFeatureFlagEnabled,
    appsPluginIsEnabled,
    (featureFlagEnabled: boolean, pluginEnabled: boolean) => {
        return featureFlagEnabled && pluginEnabled;
    },
);

export const appBarEnabled = createSelector(
    'appBarEnabled',
    (state: GlobalState) => getConfig(state),
    (config?: Partial<ClientConfig>) => {
        return config?.DisableAppBar === 'false';
    },
);

export const makeAppBindingsSelector = (location: string) => {
    return createSelector(
        'makeAppBindingsSelector',
        (state: GlobalState) => state.entities.apps.main.bindings,
        (state: GlobalState) => appsEnabled(state),
        (bindings: AppBinding[], areAppsEnabled: boolean) => {
            if (!areAppsEnabled || !bindings) {
                return [];
            }

            const headerBindings = bindings.filter((b) => b.location === location);
            return headerBindings.reduce((accum: AppBinding[], current: AppBinding) => accum.concat(current.bindings || []), []);
        },
    );
};

export const getChannelHeaderAppBindings = createSelector(
    'getChannelHeaderAppBindings',
    appBarEnabled,
    makeAppBindingsSelector(AppBindingLocations.CHANNEL_HEADER_ICON),
    (enabled: boolean, channelHeaderBindings: AppBinding[]) => {
        return enabled ? [] : channelHeaderBindings;
    },
);

export const getAppBarAppBindings = createSelector(
    'getAppBarAppBindings',
    appBarEnabled,
    makeAppBindingsSelector(AppBindingLocations.CHANNEL_HEADER_ICON),
    makeAppBindingsSelector(AppBindingLocations.APP_BAR),
    (enabled: boolean, channelHeaderBindings: AppBinding[], appBarBindings: AppBinding[]) => {
        if (!enabled) {
            return [];
        }

        const appIds = appBarBindings.map((b) => b.app_id);
        const backwardsCompatibleBindings = channelHeaderBindings.filter((b) => !appIds.includes(b.app_id));

        return appBarBindings.concat(backwardsCompatibleBindings);
    },
);

export const makeRHSAppBindingSelector = (location: string) => {
    return createSelector(
        'makeRHSAppBindingSelector',
        (state: GlobalState) => state.entities.apps.rhs.bindings,
        (state: GlobalState) => appsEnabled(state),
        (bindings: AppBinding[], areAppsEnabled: boolean) => {
            if (!areAppsEnabled || !bindings) {
                return [];
            }

            const headerBindings = bindings.filter((b) => b.location === location);
            return headerBindings.reduce((accum: AppBinding[], current: AppBinding) => accum.concat(current.bindings || []), []);
        },
    );
};

export const getAppCommandForm = (state: GlobalState, location: string) => {
    return state.entities.apps.main.forms[location];
};

export const getAppRHSCommandForm = (state: GlobalState, location: string) => {
    return state.entities.apps.rhs.forms[location];
};
