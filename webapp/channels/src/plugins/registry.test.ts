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

describe('PluginRegistry — registerPostDecorator', () => {
    const PLUGIN_ID = 'test_plugin';

    let store: ReturnType<typeof createStore<ReturnType<typeof pluginsReducer>, any, any, any>>;
    let registry: PluginRegistry;

    beforeEach(() => {
        store = createStore(pluginsReducer);
        mockCurrentStore = store;
        registry = new PluginRegistry(PLUGIN_ID);
    });

    function getDecorators() {
        return mockCurrentStore.getState().components.PostDecorator;
    }

    it('(a) valid registration adds entry to PostDecorator list', () => {
        registry.registerPostDecorator({
            slot: 'post_header_badge',
            matcher: () => true,
            component: () => null,
        });

        const decorators = getDecorators();
        expect(decorators).toHaveLength(1);
        expect(decorators[0].pluginId).toBe(PLUGIN_ID);
        expect(decorators[0].slot).toBe('post_header_badge');
    });

    it('(b) invalid slot emits console.warn and does NOT add entry', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        registry.registerPostDecorator({
            slot: 'bad_slot' as any,
            matcher: () => true,
            component: () => null,
        });

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toContain('bad_slot');
        expect(getDecorators()).toHaveLength(0);
        warnSpy.mockRestore();
    });

    it('(c) REMOVED_WEBAPP_PLUGIN sweeps all post decorators for that plugin', () => {
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerPostDecorator({
            slot: 'post_header_badge',
            matcher: () => true,
            component: () => null,
        });
        registry.registerPostDecorator({
            slot: 'post_header_badge',
            matcher: () => true,
            component: () => null,
        });
        otherRegistry.registerPostDecorator({
            slot: 'post_header_badge',
            matcher: () => false,
            component: () => null,
        });

        mockCurrentStore.dispatch({
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: PLUGIN_ID},
        });

        const decorators = getDecorators();
        expect(decorators).toHaveLength(1);
        expect(decorators[0].pluginId).toBe('other_plugin');
    });
});

describe('PluginRegistry — registerComposerPlaceholderSuffix', () => {
    const PLUGIN_ID = 'test_plugin';

    beforeEach(() => {
        mockCurrentStore = createStore(pluginsReducer);
    });

    function getSuffixes() {
        return mockCurrentStore.getState().components.ComposerPlaceholderSuffix;
    }

    it('(a) dispatches RECEIVED_PLUGIN_COMPONENT with name ComposerPlaceholderSuffix', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const matcher = () => true;
        registry.registerComposerPlaceholderSuffix({matcher, text: ' (encrypted)'});

        const suffixes = getSuffixes();
        expect(suffixes).toHaveLength(1);
        expect(suffixes[0].pluginId).toBe(PLUGIN_ID);
        expect(suffixes[0].matcher).toBe(matcher);
        expect(suffixes[0].text).toBe(' (encrypted)');
    });

    it('(b) returns a non-empty string id', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const id = registry.registerComposerPlaceholderSuffix({matcher: () => false, text: ' (x)'});
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
    });

    it('(c) REMOVED_WEBAPP_PLUGIN sweeps all suffix registrations for that plugin', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const otherRegistry = new PluginRegistry('other_plugin');

        registry.registerComposerPlaceholderSuffix({matcher: () => true, text: ' (a)'});
        registry.registerComposerPlaceholderSuffix({matcher: () => true, text: ' (b)'});
        otherRegistry.registerComposerPlaceholderSuffix({matcher: () => true, text: ' (c)'});

        mockCurrentStore.dispatch({
            type: ActionTypes.REMOVED_WEBAPP_PLUGIN,
            data: {id: PLUGIN_ID},
        });

        const suffixes = getSuffixes();
        expect(suffixes).toHaveLength(1);
        expect(suffixes[0].pluginId).toBe('other_plugin');
    });

    it('(e) two registrations from same plugin accumulate (no deduplication)', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const id1 = registry.registerComposerPlaceholderSuffix({matcher: () => true, text: ' (first)'});
        const id2 = registry.registerComposerPlaceholderSuffix({matcher: () => true, text: ' (second)'});

        expect(id1).not.toBe(id2);
        expect(getSuffixes()).toHaveLength(2);
        expect(getSuffixes()[0].text).toBe(' (first)');
        expect(getSuffixes()[1].text).toBe(' (second)');
    });

    it('(f) function text is stored as-is on the registration', () => {
        const registry = new PluginRegistry(PLUGIN_ID);
        const textFn = () => ' (dynamic)';
        registry.registerComposerPlaceholderSuffix({matcher: () => true, text: textFn});

        const suffixes = getSuffixes();
        expect(suffixes[0].text).toBe(textFn);
    });

    it('(g) two registrations from different plugins are sorted by pluginId', () => {
        const registryZ = new PluginRegistry('zzz_plugin');
        const registryA = new PluginRegistry('aaa_plugin');

        registryZ.registerComposerPlaceholderSuffix({matcher: () => true, text: ' (zzz)'});
        registryA.registerComposerPlaceholderSuffix({matcher: () => true, text: ' (aaa)'});

        const suffixes = getSuffixes();
        expect(suffixes).toHaveLength(2);
        expect(suffixes[0].pluginId).toBe('aaa_plugin');
        expect(suffixes[1].pluginId).toBe('zzz_plugin');
    });
});
