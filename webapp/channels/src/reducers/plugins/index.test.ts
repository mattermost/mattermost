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

describe('components — ChannelIconOverride slot', () => {
    it('initial state has an empty ChannelIconOverride array', () => {
        const state = pluginReducers(undefined, {type: '@@INIT'} as any);
        expect(state.components.ChannelIconOverride).toEqual([]);
    });

    it('RECEIVED_PLUGIN_COMPONENT registers an override entry', () => {
        const entry = {id: 'id-1', pluginId: 'plugin-a', matcher: () => false, iconName: 'shield-outline' as const};
        const state = pluginReducers(undefined, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelIconOverride',
            data: entry,
        });
        expect(state.components.ChannelIconOverride).toHaveLength(1);
        expect(state.components.ChannelIconOverride[0]).toMatchObject({
            id: 'id-1',
            pluginId: 'plugin-a',
            iconName: 'shield-outline',
        });
    });

    it('REMOVED_PLUGIN_COMPONENT removes only the matched entry', () => {
        let state = pluginReducers(undefined, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelIconOverride',
            data: {id: 'id-1', pluginId: 'plugin-a', matcher: () => false, iconName: 'shield-outline'},
        });
        state = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelIconOverride',
            data: {id: 'id-2', pluginId: 'plugin-b', matcher: () => true, iconName: 'lock-outline'},
        });
        state = pluginReducers(state, {type: ActionTypes.REMOVED_PLUGIN_COMPONENT, id: 'id-1'});

        expect(state.components.ChannelIconOverride).toHaveLength(1);
        expect(state.components.ChannelIconOverride[0].id).toBe('id-2');
    });

    it('REMOVED_WEBAPP_PLUGIN sweeps all overrides for that plugin', () => {
        let state = pluginReducers(undefined, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelIconOverride',
            data: {id: 'id-1', pluginId: 'plugin-a', matcher: () => false, iconName: 'shield-outline'},
        });
        state = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelIconOverride',
            data: {id: 'id-2', pluginId: 'plugin-a', matcher: () => false, iconName: 'lock-outline'},
        });
        state = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelIconOverride',
            data: {id: 'id-3', pluginId: 'plugin-b', matcher: () => true, iconName: 'globe'},
        });
        state = pluginReducers(state, {
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: 'plugin-a'},
        });

        expect(state.components.ChannelIconOverride).toHaveLength(1);
        expect(state.components.ChannelIconOverride[0].pluginId).toBe('plugin-b');
    });

    it('LOGOUT_SUCCESS resets the slot to []', () => {
        let state = pluginReducers(undefined, {
            type: ActionTypes.RECEIVED_PLUGIN_COMPONENT,
            name: 'ChannelIconOverride',
            data: {id: 'id-1', pluginId: 'plugin-a', matcher: () => false, iconName: 'shield-outline'},
        });
        state = pluginReducers(state, {type: UserTypes.LOGOUT_SUCCESS} as any);

        expect(state.components.ChannelIconOverride).toEqual([]);
    });
});
