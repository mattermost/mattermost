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

describe('PluginRegistry — registerChannelTypeOption reserved id rejection', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    it('throws when registering with the reserved open-channel id', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        expect(() => {
            registry.registerChannelTypeOption({
                id: 'O',
                label: 'Bad Option',
                description: 'sub',
                icon: () => null,
                isAvailable: () => true,
                onCreate: async () => ({status: 'deferred'}),
            });
        }).toThrow(Error);
    });

    it('throws when registering with the reserved private-channel id', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        expect(() => {
            registry.registerChannelTypeOption({
                id: 'P',
                label: 'Bad Option',
                description: 'sub',
                icon: () => null,
                isAvailable: () => true,
                onCreate: async () => ({status: 'deferred'}),
            });
        }).toThrow(Error);
    });

    it('error message names the reserved ids', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        expect(() => {
            registry.registerChannelTypeOption({
                id: 'O',
                label: 'Bad Option',
                description: 'sub',
                icon: () => null,
                isAvailable: () => true,
                onCreate: async () => ({status: 'deferred'}),
            });
        }).toThrow(/['"]?O['"]?.*['"]?P['"]?|reserved/i);
    });
});

describe('PluginRegistry — registerChannelTypeOption', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    function getOptions() {
        return mockCurrentStore.getState().components.ChannelTypeOption;
    }

    it('(a-d) registers an option and stores it in Redux state', () => {
        const registry = new PluginRegistry(PLUGIN_ID);

        registry.registerChannelTypeOption({
            id: 'test_option',
            label: 'Encrypted',
            description: 'sub',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        const options = getOptions();
        expect(options).toHaveLength(1);
        expect(options[0].id).toBe('test_option');
        expect(options[0].pluginId).toBe(PLUGIN_ID);
    });

    it('(e) re-registering same (pluginId, id) replaces the prior entry', () => {
        const registry = new PluginRegistry(PLUGIN_ID);

        const firstOnCreate = jest.fn();
        const firstIsAvailable = jest.fn();
        const secondOnCreate = jest.fn();
        const secondIsAvailable = jest.fn();

        registry.registerChannelTypeOption({
            id: 'test_option',
            label: 'Encrypted',
            description: 'sub',
            icon: () => null,
            isAvailable: firstIsAvailable,
            onCreate: firstOnCreate,
        });

        registry.registerChannelTypeOption({
            id: 'test_option',
            label: 'Updated label',
            description: 'sub',
            icon: () => null,
            isAvailable: secondIsAvailable,
            onCreate: secondOnCreate,
        });

        const options = getOptions();
        expect(options).toHaveLength(1);
        expect(options[0].label).toBe('Updated label');
        expect(options[0].onCreate).toBe(secondOnCreate);
        expect(options[0].isAvailable).toBe(secondIsAvailable);
    });

    it('(f) unregisterChannelTypeOption removes only that plugin option', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerChannelTypeOption({
            id: 'test_option',
            label: 'Encrypted',
            description: 'sub',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        otherRegistry.registerChannelTypeOption({
            id: 'other_option',
            label: 'Other',
            description: 'other sub',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        registry.unregisterChannelTypeOption('test_option');

        const options = getOptions();
        expect(options).toHaveLength(1);
        expect(options[0].pluginId).toBe('other_plugin');
        expect(options[0].id).toBe('other_option');
    });

    it('(g) REMOVED_WEBAPP_PLUGIN removes all options for that plugin', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerChannelTypeOption({
            id: 'option_1',
            label: 'A',
            description: 'd',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        registry.registerChannelTypeOption({
            id: 'option_2',
            label: 'B',
            description: 'd',
            icon: () => null,
            isAvailable: () => true,
            onCreate: async () => ({status: 'deferred'}),
        });

        otherRegistry.registerChannelTypeOption({
            id: 'other_option',
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
