// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';

import {ActionTypes} from 'utils/constants';

import type {PluginConfiguration} from 'types/plugins/user_settings';
import type {PluginsState} from 'types/store/plugins';

import pluginReducers from '.';

function getBaseState(): PluginsState {
    return {
        adminConsoleCustomComponents: {},
        adminConsoleCustomSections: {},
        adminConsoleReducers: {},
        components: {} as any,
        plugins: {},
        postCardTypes: {},
        postTypes: {},
        siteStatsHandlers: {},
        userSettings: {},
    };
}

function getDefaultSetting(): PluginConfiguration {
    return {
        id: 'pluginId',
        uiName: 'some name',
        sections: [
            {
                title: 'some title',
                settings: [
                    {
                        name: 'setting name',
                        default: '0',
                        type: 'radio',
                        options: [
                            {
                                value: '0',
                                text: 'option 0',
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

describe('user settings', () => {
    it('reject invalid settings', () => {
        const originalLog = console.warn;
        console.warn = jest.fn();

        const state = getBaseState();

        const setting = getDefaultSetting();
        setting.uiName = '';

        const nextState = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_USER_SETTINGS,
            data: {
                pluginId: 'pluginId',
                setting,
            },
        });
        expect(nextState.userSettings).toEqual({});
        expect(console.warn).toHaveBeenCalled();
        console.warn = originalLog;
    });

    it('add valid ids', () => {
        const setting = getDefaultSetting();
        const state = getBaseState();
        const nextState = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_USER_SETTINGS,
            data: {
                pluginId: 'pluginId',
                setting,
            },
        });
        expect(nextState.userSettings).toEqual({pluginId: setting});
    });

    it('removing a plugin removes the setting', () => {
        const state = getBaseState();
        state.userSettings.pluginId = getDefaultSetting();
        const nextState = pluginReducers(state, {
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {
                id: 'pluginId',
            },
        });
        expect(nextState.userSettings).toEqual({});
    });

    it('removing a different plugin does not remove the setting', () => {
        const state = getBaseState();
        state.userSettings.pluginId = getDefaultSetting();
        const nextState = pluginReducers(state, {
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {
                id: 'otherPluginId',
            },
        });
        expect(nextState.userSettings).toEqual(state.userSettings);
    });

    it('on logout all settings are removed', () => {
        const state = getBaseState();
        state.userSettings.pluginId = getDefaultSetting();
        state.userSettings.otherPluginId = {...getDefaultSetting(), id: 'otherPluginId'};
        const nextState = pluginReducers(state, {
            type: UserTypes.LOGOUT_SUCCESS,
        });
        expect(nextState.userSettings).toEqual({});
    });
});

describe('generic component registration', () => {
    const DummyChannelSettingsTab = () => null;

    it('adds a channel settings tab registration', () => {
        const state = getBaseState();
        const shouldRender = jest.fn(() => false);
        const registration = {
            id: 'tab-1',
            pluginId: 'plugin-b',
            uiName: 'Plugin Tab',
            icon: 'icon-plugin-tab',
            shouldRender,
            component: DummyChannelSettingsTab,
        };

        const nextState = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelSettingsTab',
            data: registration,
        });

        expect(nextState.components.ChannelSettingsTab).toEqual([registration]);
    });

    it('sorts channel settings tab registrations by pluginId', () => {
        const state = getBaseState();
        const pluginBRegistration = {
            id: 'tab-1',
            pluginId: 'plugin-b',
            uiName: 'Plugin B Tab',
            icon: 'icon-plugin-b-tab',
            shouldRender: jest.fn(() => true),
            component: DummyChannelSettingsTab,
        };
        const pluginARegistration = {
            id: 'tab-2',
            pluginId: 'plugin-a',
            uiName: 'Plugin A Tab',
            icon: 'icon-plugin-a-tab',
            shouldRender: jest.fn(() => true),
            component: DummyChannelSettingsTab,
        };

        const intermediateState = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelSettingsTab',
            data: pluginBRegistration,
        });
        const nextState = pluginReducers(intermediateState, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelSettingsTab',
            data: pluginARegistration,
        });

        expect(nextState.components.ChannelSettingsTab).toEqual([
            pluginARegistration,
            pluginBRegistration,
        ]);
    });

    it('removes channel settings tab registrations when the owning plugin is removed', () => {
        const pluginARegistration = {
            id: 'tab-1',
            pluginId: 'plugin-a',
            uiName: 'Plugin A Tab',
            icon: 'icon-plugin-a-tab',
            shouldRender: jest.fn(() => true),
            component: DummyChannelSettingsTab,
        };
        const pluginBRegistration = {
            id: 'tab-2',
            pluginId: 'plugin-b',
            uiName: 'Plugin B Tab',
            icon: 'icon-plugin-b-tab',
            shouldRender: jest.fn(() => true),
            component: DummyChannelSettingsTab,
        };
        const state = getBaseState();
        state.components = {
            ChannelSettingsTab: [pluginARegistration, pluginBRegistration],
        } as any;

        const nextState = pluginReducers(state, {
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {
                id: 'plugin-a',
            },
        });

        expect(nextState.components.ChannelSettingsTab).toEqual([pluginBRegistration]);
    });

    it('resets channel settings tab registrations on logout', () => {
        const state = getBaseState();
        state.components = {
            ChannelSettingsTab: [{
                id: 'tab-1',
                pluginId: 'plugin-a',
                uiName: 'Plugin A Tab',
                icon: 'icon-plugin-a-tab',
                shouldRender: jest.fn(() => true),
                component: DummyChannelSettingsTab,
            }],
        } as any;

        const nextState = pluginReducers(state, {
            type: UserTypes.LOGOUT_SUCCESS,
        });

        expect(nextState.components.ChannelSettingsTab).toEqual([]);
    });
});
