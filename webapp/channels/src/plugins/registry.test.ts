// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createStore} from 'redux';

import pluginsReducer from 'reducers/plugins';

import {ActionTypes} from 'utils/constants';

import type {ProductComponent} from 'types/store/plugins';

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

describe('PluginRegistry — registerChannelComposerBannerComponent', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    function getBanners() {
        return mockCurrentStore.getState().components.ChannelComposerBanner;
    }

    it('adds an entry to ChannelComposerBanner with the plugin id', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        registry.registerChannelComposerBannerComponent({component: () => null});

        const entries = getBanners();
        expect(entries).toHaveLength(1);
        expect(entries[0].pluginId).toBe(PLUGIN_ID);
    });

    it('REMOVED_WEBAPP_PLUGIN sweeps entries for that plugin and leaves others intact', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerChannelComposerBannerComponent({component: () => null});
        otherRegistry.registerChannelComposerBannerComponent({component: () => null});

        mockCurrentStore.dispatch({
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: PLUGIN_ID},
        });

        const entries = getBanners();
        expect(entries).toHaveLength(1);
        expect(entries[0].pluginId).toBe('other_plugin');
    });
});

describe('PluginRegistry — registerChannelIntro', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    function getIntroRegs() {
        return mockCurrentStore.getState().components.ChannelIntro;
    }

    it('adds an entry to ChannelIntro with the plugin id, matcher, and component', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const matcher = () => true;
        const component = () => null;
        registry.registerChannelIntro({matcher, component});

        const entries = getIntroRegs();
        expect(entries).toHaveLength(1);
        expect(entries[0].pluginId).toBe(PLUGIN_ID);
        expect(entries[0].matcher).toBe(matcher);
        expect(entries[0].component).toBe(component);
    });

    it('REMOVED_WEBAPP_PLUGIN sweeps entries for that plugin and leaves others intact', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerChannelIntro({matcher: () => true, component: () => null});
        otherRegistry.registerChannelIntro({matcher: () => false, component: () => null});

        mockCurrentStore.dispatch({
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: PLUGIN_ID},
        });

        const entries = getIntroRegs();
        expect(entries).toHaveLength(1);
        expect(entries[0].pluginId).toBe('other_plugin');
    });
});

describe('PluginRegistry — registerPostHeaderComponent', () => {
    const PLUGIN_ID = 'test_plugin';

    let store: ReturnType<typeof createStore<ReturnType<typeof pluginsReducer>, any, any, any>>;
    let registry: PluginRegistry;

    beforeEach(() => {
        store = createStore(pluginsReducer);
        mockCurrentStore = store;
        registry = new PluginRegistry(PLUGIN_ID);
    });

    function getComponents() {
        return mockCurrentStore.getState().components.PostHeader;
    }

    it('(a) registration adds an entry to the PostHeader list and returns its id', () => {
        const id = registry.registerPostHeaderComponent(() => null);

        const components = getComponents();
        expect(components).toHaveLength(1);
        expect(components[0].id).toBe(id);
        expect(components[0].pluginId).toBe(PLUGIN_ID);
    });

    it('(b) REMOVED_WEBAPP_PLUGIN sweeps all post-header components for that plugin', () => {
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerPostHeaderComponent(() => null);
        registry.registerPostHeaderComponent(() => null);
        otherRegistry.registerPostHeaderComponent(() => null);

        mockCurrentStore.dispatch({
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: PLUGIN_ID},
        });

        const components = getComponents();
        expect(components).toHaveLength(1);
        expect(components[0].pluginId).toBe('other_plugin');
    });
});

describe('PluginRegistry — registerProductSwitcherMenuItem', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    function getItems() {
        return mockCurrentStore.getState().components.ProductSwitcherMenuItem;
    }

    it('(a) reduced entry has pluginId, text, icon, and action by reference', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const action = jest.fn();

        // Use a string glyph name as icon — resolveReactElement passes strings through unchanged.
        const icon = 'shield-outline';
        registry.registerProductSwitcherMenuItem({text: 'My Item', icon, action});

        const items = getItems();
        expect(items).toHaveLength(1);
        expect(items[0].pluginId).toBe(PLUGIN_ID);
        expect(items[0].text).toBe('My Item');
        expect(items[0].icon).toBe(icon);
        expect(items[0].action).toBe(action);
    });

    it('(a2) returns the non-empty string id of the stored entry', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const id = registry.registerProductSwitcherMenuItem({text: 'My Item', icon: 'globe', action: () => {}});
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
        expect(getItems()[0].id).toBe(id);
    });

    it('(b) isHidden omitted stores undefined; provided function stored by reference', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        registry.registerProductSwitcherMenuItem({text: 'No Gate', icon: 'globe', action: () => {}});
        expect(getItems()[0].isHidden).toBeUndefined();

        mockCurrentStore = createStore(pluginsReducer);
        const isHidden = jest.fn(() => true);
        registry.registerProductSwitcherMenuItem({text: 'Gated', icon: 'globe', action: () => {}, isHidden});
        expect(getItems()[0].isHidden).toBe(isHidden);
    });

    it('(c) re-registration produces a second independent entry', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        registry.registerProductSwitcherMenuItem({text: 'Item 1', icon: 'globe', action: () => {}});
        registry.registerProductSwitcherMenuItem({text: 'Item 2', icon: 'globe', action: () => {}});

        const items = getItems();
        expect(items).toHaveLength(2);
        expect(items[0].id).not.toBe(items[1].id);
    });

    it('(d) REMOVED_WEBAPP_PLUGIN sweeps all entries for that plugin, leaves other plugins', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerProductSwitcherMenuItem({text: 'Item 1', icon: 'globe', action: () => {}});
        registry.registerProductSwitcherMenuItem({text: 'Item 2', icon: 'globe', action: () => {}});
        otherRegistry.registerProductSwitcherMenuItem({text: 'Other Item', icon: 'globe', action: () => {}});

        mockCurrentStore.dispatch({
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: PLUGIN_ID},
        });

        const items = getItems();
        expect(items).toHaveLength(1);
        expect(items[0].pluginId).toBe('other_plugin');
    });

    it('(e) LOGOUT_SUCCESS resets the slot to []', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        registry.registerProductSwitcherMenuItem({text: 'Item', icon: 'globe', action: () => {}});
        expect(getItems()).toHaveLength(1);

        mockCurrentStore.dispatch({type: 'LOGOUT_SUCCESS'});

        expect(getItems()).toHaveLength(0);
    });

    it('(f) registrations from different plugins are sorted alphabetically by pluginId', () => {
        const registryZ = new PluginRegistry('zzz_plugin');
        const registryA = new PluginRegistry('aaa_plugin');
        const registryM = new PluginRegistry('mmm_plugin');

        registryZ.registerProductSwitcherMenuItem({text: 'ZZZ Item', icon: 'globe', action: () => {}});
        registryA.registerProductSwitcherMenuItem({text: 'AAA Item', icon: 'globe', action: () => {}});
        registryM.registerProductSwitcherMenuItem({text: 'MMM Item', icon: 'globe', action: () => {}});

        const items = getItems();
        expect(items).toHaveLength(3);
        expect(items[0].pluginId).toBe('aaa_plugin');
        expect(items[1].pluginId).toBe('mmm_plugin');
        expect(items[2].pluginId).toBe('zzz_plugin');
    });
});

describe('PluginRegistry — registerComposerPlaceholder', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    function getRegistrations() {
        return mockCurrentStore.getState().components.ComposerPlaceholder;
    }

    it('(a) dispatches RECEIVED_PLUGIN_COMPONENT with name ComposerPlaceholder, storing transform as-is', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const transform = (p: string) => `${p} (encrypted)`;
        registry.registerComposerPlaceholder({transform});

        const registrations = getRegistrations();
        expect(registrations).toHaveLength(1);
        expect(registrations[0].pluginId).toBe(PLUGIN_ID);
        expect(registrations[0].transform).toBe(transform);
    });

    it('(b) returns a non-empty string id', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const id = registry.registerComposerPlaceholder({transform: (p) => p});
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    it('(c) REMOVED_WEBAPP_PLUGIN sweeps all registrations for that plugin', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerComposerPlaceholder({transform: (p) => `${p} (a)`});
        registry.registerComposerPlaceholder({transform: (p) => `${p} (b)`});
        otherRegistry.registerComposerPlaceholder({transform: (p) => `${p} (c)`});

        mockCurrentStore.dispatch({
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: PLUGIN_ID},
        });

        const registrations = getRegistrations();
        expect(registrations).toHaveLength(1);
        expect(registrations[0].pluginId).toBe('other_plugin');
    });

    it('(e) two registrations from same plugin accumulate in insertion order (no deduplication)', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const first = (p: string) => `${p} (first)`;
        const second = (p: string) => `${p} (second)`;
        const id1 = registry.registerComposerPlaceholder({transform: first});
        const id2 = registry.registerComposerPlaceholder({transform: second});

        expect(id1).not.toBe(id2);
        expect(getRegistrations()).toHaveLength(2);
        expect(getRegistrations()[0].transform).toBe(first);
        expect(getRegistrations()[1].transform).toBe(second);
    });

    it('(g) two registrations from different plugins are sorted by pluginId', () => {
        const registryZ = new PluginRegistry('zzz_plugin');
        const registryA = new PluginRegistry('aaa_plugin');

        registryZ.registerComposerPlaceholder({transform: (p) => `${p} (zzz)`});
        registryA.registerComposerPlaceholder({transform: (p) => `${p} (aaa)`});

        const registrations = getRegistrations();
        expect(registrations).toHaveLength(2);
        expect(registrations[0].pluginId).toBe('aaa_plugin');
        expect(registrations[1].pluginId).toBe('zzz_plugin');
    });
});

describe('PluginRegistry — registerProduct', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    function getProducts() {
        return mockCurrentStore.getState().components.Product;
    }

    const baseArgs: Omit<ProductComponent, 'id' | 'pluginId' | 'baseURL' | 'isTeamScoped'> = {
        switcherIcon: 'shield-outline',
        switcherText: 'Docs',
        switcherLinkURL: '/spaces',
        mainComponent: () => null,
        headerCentreComponent: () => null,
        headerRightComponent: () => null,
        showTeamSidebar: false,
        showAppBar: false,
        wrapped: true,
        publicComponent: () => null,
    };

    it('passes isTeamScoped through to the stored product when team-scoped', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        registry.registerProduct({...baseArgs, baseURL: '/spaces', isTeamScoped: true});

        const products = getProducts();
        expect(products).toHaveLength(1);
        expect(products[0].isTeamScoped).toBe(true);
    });

    it('passes isTeamScoped through to the stored product when global', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        registry.registerProduct({...baseArgs, baseURL: '/boards', isTeamScoped: false});

        expect(getProducts()[0].isTeamScoped).toBe(false);
    });
});
