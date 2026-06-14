// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createStore} from 'redux';

import pluginsReducer from 'reducers/plugins';

import {ActionTypes} from 'utils/constants';

import PluginRegistry from './registry';

// Replace the module-singleton store so registry.ts dispatches into our real reducer store.
// Jest hoists mock factories before module imports, so `mockGetStore` is used as an indirection:
// the factory closes over it, and tests reassign the underlying store instance per-test.
let mockCurrentStore: ReturnType<typeof createStore<ReturnType<typeof pluginsReducer>, any, any, any>>;

jest.mock('stores/redux_store', () => ({
    dispatch: (...args: any[]) => mockCurrentStore.dispatch(...args),
    getState: () => mockCurrentStore.getState(),
    subscribe: (...args: any[]) => mockCurrentStore.subscribe(...args),
}));

// Stub out side-effecting imports that registry.ts pulls in but aren't needed for this test.
jest.mock('mattermost-redux/store/reducer_registry', () => ({default: {register: jest.fn()}, register: jest.fn()}));
jest.mock('actions/admin_actions', () => ({
    registerAdminConsolePlugin: jest.fn(),
    unregisterAdminConsolePlugin: jest.fn(),
    registerAdminConsoleCustomSetting: jest.fn(),
    registerAdminConsoleCustomSection: jest.fn(),
}));
jest.mock('actions/views/rhs', () => ({
    showRHSPlugin: jest.fn(),
    hideRHSPlugin: jest.fn(),
    toggleRHSPlugin: jest.fn(),
}));
jest.mock('actions/views/root', () => ({
    registerPluginTranslationsSource: jest.fn(),
}));
jest.mock('actions/websocket_actions', () => ({
    registerPluginWebSocketEvent: jest.fn(),
    unregisterPluginWebSocketEvent: jest.fn(),
    registerPluginReconnectHandler: jest.fn(),
    unregisterPluginReconnectHandler: jest.fn(),
}));
jest.mock('utils/popouts/popout_windows', () => ({
    registerRHSPluginPopoutListener: jest.fn(),
}));

describe('PluginRegistry — registerChannelTypeOption', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    function getOptions() {
        return mockCurrentStore.getState().components.ChannelTypeOption;
    }

    it('registers an option with an auto-generated id and stores it in Redux state', () => {
        const registry = new PluginRegistry(PLUGIN_ID);

        const id = registry.registerChannelTypeOption({
            label: 'Encrypted',
            description: 'sub',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        const options = getOptions();
        expect(options).toHaveLength(1);
        expect(typeof id).toBe('string');
        expect(id).toBeTruthy();
        expect(options[0].id).toBe(id);
        expect(options[0].pluginId).toBe(PLUGIN_ID);
    });

    it('registering twice creates two entries with distinct ids', () => {
        const registry = new PluginRegistry(PLUGIN_ID);

        const firstId = registry.registerChannelTypeOption({
            label: 'A',
            description: 'sub',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        const secondId = registry.registerChannelTypeOption({
            label: 'B',
            description: 'sub',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        const options = getOptions();
        expect(options).toHaveLength(2);
        expect(firstId).not.toBe(secondId);
    });

    it('REMOVED_WEBAPP_PLUGIN removes all options for that plugin', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerChannelTypeOption({
            label: 'A',
            description: 'd',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        registry.registerChannelTypeOption({
            label: 'B',
            description: 'd',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        otherRegistry.registerChannelTypeOption({
            label: 'C',
            description: 'd',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        mockCurrentStore.dispatch({
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: PLUGIN_ID},
        });

        const options = getOptions();
        expect(options).toHaveLength(1);
        expect(options[0].pluginId).toBe('other_plugin');
    });
});

describe('PluginRegistry — registerChannelIconOverride', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    function getOverrides() {
        return mockCurrentStore.getState().components.ChannelIconOverride;
    }

    it('(a) returns a string id', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const id = registry.registerChannelIconOverride({
            matcher: () => false,
            iconName: 'shield-outline',
        });
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    it('(b) reduced entry has pluginId, matcher, and iconName', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const matcher = () => false;
        registry.registerChannelIconOverride({matcher, iconName: 'shield-outline'});

        const overrides = getOverrides();
        expect(overrides).toHaveLength(1);
        expect(overrides[0].pluginId).toBe(PLUGIN_ID);
        expect(overrides[0].matcher).toBe(matcher);
        expect(overrides[0].iconName).toBe('shield-outline');
    });

    it('(c) re-registering produces a second entry with a different id', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const id1 = registry.registerChannelIconOverride({matcher: () => false, iconName: 'shield-outline'});
        const id2 = registry.registerChannelIconOverride({matcher: () => true, iconName: 'lock-outline'});

        expect(id1).not.toBe(id2);
        expect(getOverrides()).toHaveLength(2);
    });

    it('(d) REMOVED_WEBAPP_PLUGIN sweeps all overrides for that plugin', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerChannelIconOverride({matcher: () => false, iconName: 'shield-outline'});
        registry.registerChannelIconOverride({matcher: () => false, iconName: 'lock-outline'});
        otherRegistry.registerChannelIconOverride({matcher: () => true, iconName: 'globe'});

        mockCurrentStore.dispatch({
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: PLUGIN_ID},
        });

        const overrides = getOverrides();
        expect(overrides).toHaveLength(1);
        expect(overrides[0].pluginId).toBe('other_plugin');
    });

    it('(f) LOGOUT_SUCCESS resets the slot to []', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        registry.registerChannelIconOverride({matcher: () => false, iconName: 'shield-outline'});
        expect(getOverrides()).toHaveLength(1);

        mockCurrentStore.dispatch({type: 'LOGOUT_SUCCESS'});

        expect(getOverrides()).toHaveLength(0);
    });

    it('(g) two registrations from different plugins are sorted by pluginId', () => {
        const registryA = new PluginRegistry('aaa_plugin');
        const registryZ = new PluginRegistry('zzz_plugin');

        registryZ.registerChannelIconOverride({matcher: () => false, iconName: 'shield-outline'});
        registryA.registerChannelIconOverride({matcher: () => true, iconName: 'lock-outline'});

        const overrides = getOverrides();
        expect(overrides).toHaveLength(2);
        expect(overrides[0].pluginId).toBe('aaa_plugin');
        expect(overrides[1].pluginId).toBe('zzz_plugin');
    });

    it('(h) registering with an unknown iconName logs an error and does not add an entry', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const registry = new PluginRegistry(PLUGIN_ID);

        registry.registerChannelIconOverride({
            matcher: () => false,
            iconName: 'not-a-real-icon' as any,
        });

        expect(getOverrides()).toHaveLength(0);
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0][0]).toContain('not-a-real-icon');
        consoleSpy.mockRestore();
    });

    it('(j) registering with a prototype-inherited key logs an error and does not add an entry', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const registry = new PluginRegistry(PLUGIN_ID);

        registry.registerChannelIconOverride({
            matcher: () => false,
            iconName: 'constructor' as any,
        });

        expect(getOverrides()).toHaveLength(0);
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
    });
});
