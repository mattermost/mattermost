// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppBinding} from '@mattermost/types/apps';

import {Preferences} from 'mattermost-redux/constants';
import {createSelector} from 'mattermost-redux/selectors/create_selector';
import {appBarEnabled, getAppBarAppBindings} from 'mattermost-redux/selectors/entities/apps';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {createShallowSelector} from 'mattermost-redux/utils/helpers';

import {isValidPluginConfiguration} from 'utils/plugins/plugin_setting_validation';

import type {PluginConfiguration} from 'types/plugins/user_settings';
import type {GlobalState} from 'types/store';
import type {FileDropdownPluginComponent, PluginComponent} from 'types/store/plugins';

export const getPluginUserSettings = createSelector(
    'getPluginUserSettings',
    (state: GlobalState) => state.plugins.userSettings,
    (settings) => {
        // Just for testing, to remove before merging
        if (!settings || !Object.values(settings).length) {
            // eslint-disable-next-line no-param-reassign
            settings = {
                'com.mattermost.msteams-sync': {
                    id: 'com.mattermost.msteams-sync',
                    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg/1200px-Microsoft_Office_Teams_%282018%E2%80%93present%29.svg.png',
                    uiName: 'MS Teams Sync',
                    settings: [{
                        name: 'primary_platform',
                        options: [
                            {text: 'Mattermost will be my primary platform', value: 'mm', helpText: 'You will need to disable notifications in Microsoft Teams to avoid duplicates. **[Learn more](http://google.com)**'},
                            {text: 'Microsoft Teams will be my primary platform', value: 'teams', helpText: 'Notifications in Mattermost will be muted for linked channels and DMs to prevent duplicates. Unread statuses in linked channels and DMs will also be disabled in Mattermost. **[Learn more](http://google.com)**'}],
                        title: 'Primary platform for communication',
                        type: 'radio',
                        default: 'mm',
                        helpText: 'Note: Unread statuses for linked channels and DMs will not be synced between Mattermost & Microsoft Teams.',
                    }],
                },
            };
        }

        return Object.keys(settings).reduce<{[pluginId: string]: PluginConfiguration}>((prev, curr) => {
            const setting = settings[curr];
            if (isValidPluginConfiguration(setting) && curr === setting.id) {
                prev[curr] = setting;
            }
            return prev;
        }, {});
    },
);

export const getFilesDropdownPluginMenuItems = createSelector(
    'getFilesDropdownPluginMenuItems',
    (state: GlobalState) => state.plugins.components.FilesDropdown,
    (components) => {
        return (components || []) as unknown as FileDropdownPluginComponent[];
    },
);

export const getUserGuideDropdownPluginMenuItems = createSelector(
    'getUserGuideDropdownPluginMenuItems',
    (state: GlobalState) => state.plugins.components.UserGuideDropdown,
    (components) => {
        return components;
    },
);

export const getChannelHeaderPluginComponents = createSelector(
    'getChannelHeaderPluginComponents',
    (state: GlobalState) => appBarEnabled(state),
    (state: GlobalState) => state.plugins.components.ChannelHeaderButton,
    (state: GlobalState) => state.plugins.components.AppBar,
    (enabled, channelHeaderComponents = [], appBarComponents = []) => {
        if (!enabled || !appBarComponents.length) {
            return channelHeaderComponents as unknown as PluginComponent[];
        }

        // Remove channel header icons for plugins that have also registered an app bar component
        const appBarPluginIds = appBarComponents.map((appBarComponent) => appBarComponent.pluginId);
        return channelHeaderComponents.filter((channelHeaderComponent) => !appBarPluginIds.includes(channelHeaderComponent.pluginId));
    },
);

const getChannelHeaderMenuPluginComponentsShouldRender = createSelector(
    'getChannelHeaderMenuPluginComponentsShouldRender',
    (state: GlobalState) => state,
    (state: GlobalState) => state.plugins.components.ChannelHeader,
    (state, channelHeaderMenuComponents = []) => {
        return channelHeaderMenuComponents.map((component) => {
            if (typeof component.shouldRender === 'function') {
                return component.shouldRender(state);
            }

            return true;
        });
    },
);

export const getChannelHeaderMenuPluginComponents = createShallowSelector(
    'getChannelHeaderMenuPluginComponents',
    getChannelHeaderMenuPluginComponentsShouldRender,
    (state: GlobalState) => state.plugins.components.ChannelHeader,
    (componentShouldRender = [], channelHeaderMenuComponents = []) => {
        return channelHeaderMenuComponents.filter((component, idx) => componentShouldRender[idx]);
    },
);

export const getChannelIntroPluginButtons = createSelector(
    'getChannelIntroPluginButtons',
    (state: GlobalState) => state.plugins.components.ChannelIntroButton,
    (components = []) => {
        return components;
    },
);

export const getAppBarPluginComponents = createSelector(
    'getAppBarPluginComponents',
    (state: GlobalState) => state.plugins.components.AppBar,
    (components = []) => {
        return components;
    },
);

export const shouldShowAppBar = createSelector(
    'shouldShowAppBar',
    appBarEnabled,
    getAppBarAppBindings,
    getAppBarPluginComponents,
    getChannelHeaderPluginComponents,
    (enabled: boolean, bindings: AppBinding[], appBarComponents: PluginComponent[], channelHeaderComponents) => {
        return enabled && Boolean(bindings.length || appBarComponents.length || channelHeaderComponents.length);
    },
);

export function showNewChannelWithBoardPulsatingDot(state: GlobalState): boolean {
    const pulsatingDotState = get(state, Preferences.APP_BAR, Preferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED, '');
    const showPulsatingDot = pulsatingDotState !== '' && JSON.parse(pulsatingDotState)[Preferences.NEW_CHANNEL_WITH_BOARD_TOUR_SHOWED] === false;
    return showPulsatingDot;
}
