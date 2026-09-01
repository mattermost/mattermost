// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTypes} from 'mattermost-redux/action_types';

import store from 'stores/redux_store';

import PluginRegistry from 'plugins/registry';
import {ActionTypes} from 'utils/constants';

import type {PluginConfiguration} from 'types/plugins/user_settings';
import type {MMAction} from 'types/store';
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
        channelSettingsTabs: [],
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

describe('channel settings tabs', () => {
    const DummyChannelSettingsTab = () => null;

    function rawCustomTab(overrides: Record<string, unknown> = {}) {
        return {
            id: 'tab-1',
            pluginId: 'plugin-b',
            uiName: 'Plugin Tab',
            icon: 'icon-plugin-tab',
            shouldRender: jest.fn(() => false),
            component: DummyChannelSettingsTab,
            ...overrides,
        };
    }

    beforeEach(() => {
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('adds a normalized channel settings tab registration', () => {
        const state = getBaseState();
        const registration = rawCustomTab();

        const nextState = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_CHANNEL_SETTINGS_TAB,
            data: registration,
        });

        expect(nextState.channelSettingsTabs).toEqual([{
            id: 'tab-1',
            pluginId: 'plugin-b',
            kind: 'custom',
            uiName: 'Plugin Tab',
            icon: 'icon-plugin-tab',
            shouldRender: registration.shouldRender,
            component: DummyChannelSettingsTab,
        }]);
    });

    it('rejects an invalid channel settings tab registration and warns', () => {
        const state = getBaseState();

        const nextState = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_CHANNEL_SETTINGS_TAB,
            data: {id: 'tab-1', pluginId: 'plugin-b'},
        });

        expect(nextState.channelSettingsTabs).toEqual([]);

        // eslint-disable-next-line no-console
        expect(console.warn).toHaveBeenCalled();
    });

    it('sorts channel settings tab registrations by pluginId', () => {
        const state = getBaseState();

        const intermediateState = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_CHANNEL_SETTINGS_TAB,
            data: rawCustomTab({id: 'tab-1', pluginId: 'plugin-b', uiName: 'Plugin B Tab'}),
        });
        const nextState = pluginReducers(intermediateState, {
            type: ActionTypes.RECEIVED_PLUGIN_CHANNEL_SETTINGS_TAB,
            data: rawCustomTab({id: 'tab-2', pluginId: 'plugin-a', uiName: 'Plugin A Tab'}),
        });

        expect(nextState.channelSettingsTabs.map((tab) => tab.pluginId)).toEqual(['plugin-a', 'plugin-b']);
    });

    it('removes channel settings tab registrations when the owning plugin is removed', () => {
        const state = getBaseState();
        let nextState = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_CHANNEL_SETTINGS_TAB,
            data: rawCustomTab({id: 'tab-1', pluginId: 'plugin-a', uiName: 'Plugin A Tab'}),
        });
        nextState = pluginReducers(nextState, {
            type: ActionTypes.RECEIVED_PLUGIN_CHANNEL_SETTINGS_TAB,
            data: rawCustomTab({id: 'tab-2', pluginId: 'plugin-b', uiName: 'Plugin B Tab'}),
        });

        nextState = pluginReducers(nextState, {
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {
                id: 'plugin-a',
            },
        });

        expect(nextState.channelSettingsTabs.map((tab) => tab.pluginId)).toEqual(['plugin-b']);
    });

    it('resets channel settings tab registrations on logout', () => {
        const state = getBaseState();
        const nextState = pluginReducers(state, {
            type: ActionTypes.RECEIVED_PLUGIN_CHANNEL_SETTINGS_TAB,
            data: rawCustomTab({id: 'tab-1', pluginId: 'plugin-a', uiName: 'Plugin A Tab'}),
        });

        const loggedOutState = pluginReducers(nextState, {
            type: UserTypes.LOGOUT_SUCCESS,
        });

        expect(loggedOutState.channelSettingsTabs).toEqual([]);
    });

    // Regression: a declarative schema that includes `loadValues` must survive
    // the real `registry.registerChannelSettingsTab` path. The `reArg` keyOrder
    // has to list every accepted field, otherwise the registration is mis-zipped
    // and the reducer rejects it as invalid.
    it('registers a declarative schema tab with loadValues through the real registry path', () => {
        const dispatch = jest.spyOn(store, 'dispatch').mockImplementation(jest.fn());

        const registry = new PluginRegistry('plugin-c');

        const onSave = jest.fn(async () => {});
        const loadValues = jest.fn(async () => ({colorScheme: 'dark'}));

        const id = registry.registerChannelSettingsTab({
            uiName: 'Plugin C Tab',
            icon: 'icon-plugin-c',
            sections: [{
                title: 'Appearance',
                settings: [{
                    name: 'colorScheme',
                    type: 'radio',
                    default: 'light',
                    options: [
                        {value: 'light', text: 'Light'},
                        {value: 'dark', text: 'Dark'},
                    ],
                }],
            }],
            onSave,
            loadValues,
        });

        expect(dispatch).toHaveBeenCalledTimes(1);

        const action = dispatch.mock.calls[0][0] as unknown as MMAction;
        expect(action.type).toBe(ActionTypes.RECEIVED_PLUGIN_CHANNEL_SETTINGS_TAB);
        expect(action.data.id).toBe(id);

        const nextState = pluginReducers(getBaseState(), action);

        expect(nextState.channelSettingsTabs).toHaveLength(1);

        const tab = nextState.channelSettingsTabs[0];
        expect(tab).toMatchObject({pluginId: 'plugin-c', uiName: 'Plugin C Tab', kind: 'schema'});
        if (tab.kind !== 'schema') {
            throw new Error('expected a schema tab');
        }
        expect(tab.schema.loadValues).toBe(loadValues);
        expect(tab.schema.onSave).toBe(onSave);
        expect(tab.schema.sections).toHaveLength(1);
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
