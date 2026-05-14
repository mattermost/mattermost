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

describe('components — REMOVED_PLUGIN_COMPONENT_BY_ID', () => {
    it('warns and returns unchanged state when id field is empty', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const state = getBaseState();
        const nextState = pluginReducers(state, {
            type: ActionTypes.REMOVED_PLUGIN_COMPONENT_BY_ID,
            name: 'ChannelTypeOption',
            pluginId: 'test_plugin',
            id: '',
        });

        expect(nextState).toBe(state);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('cross-bucket isolation: removal targets only the named bucket', () => {
        const channelTypeEntry = {id: 'option-a', pluginId: 'plugin-x'};
        const channelHeaderEntry = {id: 'btn-a', pluginId: 'plugin-x'};

        // Seed both buckets
        let state = getBaseState();
        state = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelTypeOption',
            data: channelTypeEntry,
        });
        state = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelHeaderButton',
            data: channelHeaderEntry,
        });

        // Remove from ChannelHeaderButton bucket only
        const nextState = pluginReducers(state, {
            type: ActionTypes.REMOVED_PLUGIN_COMPONENT_BY_ID,
            name: 'ChannelHeaderButton',
            pluginId: 'plugin-x',
            id: 'btn-a',
        });

        expect(nextState.components.ChannelHeaderButton).toHaveLength(0);
        expect(nextState.components.ChannelTypeOption).toHaveLength(1);
        expect(nextState.components.ChannelTypeOption[0]).toMatchObject(channelTypeEntry);
    });

    it('no-match preserves state identity', () => {
        const entry = {id: 'foo', pluginId: 'plugin-y'};
        let state = getBaseState();
        state = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelTypeOption',
            data: entry,
        });

        // Dispatch with an id that does not match
        const nextState = pluginReducers(state, {
            type: ActionTypes.REMOVED_PLUGIN_COMPONENT_BY_ID,
            name: 'ChannelTypeOption',
            pluginId: 'plugin-y',
            id: 'bar',
        });

        expect(nextState).toBe(state);
    });
});
