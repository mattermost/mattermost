// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createStore} from 'redux';

import type {PluginManifest} from '@mattermost/types/plugins';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {unregisterAdminConsolePlugin} from 'actions/admin_actions';
import {unregisterPluginTranslationsSource} from 'actions/views/root';
import {registerPluginWebSocketEvent, unregisterAllPluginWebSocketEvents, unregisterPluginReconnectHandler} from 'actions/websocket_actions';
import pluginsReducer from 'reducers/plugins';
import store from 'stores/redux_store';

import type PluginRegistry from 'plugins/registry';

import {logPluginLoadFailure, removeWebappPlugin} from './actions';

import {loadPlugin, removePlugin} from './index';

jest.mock('stores/redux_store', () => ({
    getState: jest.fn(() => ({})),
    dispatch: jest.fn(),
}));
jest.mock('mattermost-redux/selectors/entities/general', () => ({
    ...jest.requireActual('mattermost-redux/selectors/entities/general'),
    getConfig: jest.fn(() => ({PluginsEnabled: 'true'})),
    isPerformanceDebuggingEnabled: jest.fn(() => false),
}));
jest.mock('mattermost-redux/store/reducer_registry');
jest.mock('utils/popouts/popout_windows');
jest.mock('actions/admin_actions');
jest.mock('actions/views/root');
jest.mock('actions/websocket_actions');
jest.mock('./actions');

const pluginWindow = window as unknown as {
    registerPlugin: (id: string, plugin: {initialize?: (registry: PluginRegistry) => void | Promise<void>; uninitialize?: () => void; deinitialize?: () => void}) => void;
    plugins: Record<string, unknown>;
};

describe('loadPlugin', () => {
    let manifest: PluginManifest;
    let pluginNumber = 0;

    function getScript() {
        return document.getElementById('plugin_' + manifest.id) as HTMLScriptElement;
    }

    beforeEach(() => {
        // Failed IDs remain disabled for the page lifetime, so each test uses a new plugin.
        manifest = {
            id: `startup-test-${pluginNumber++}`,
            version: '1.0.0',
            webapp: {bundle_path: '/static/plugins/startup-test/main.js'},
        } as PluginManifest;
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        removePlugin(manifest);
        delete pluginWindow.plugins[manifest.id];
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('resolves when plugins are disabled', async () => {
        jest.mocked(getConfig).mockReturnValueOnce({PluginsEnabled: 'false'});
        await expect(loadPlugin(manifest)).resolves.toBeUndefined();
        expect(getScript()).toBeNull();
    });

    test('waits for asynchronous registration after the script loads', async () => {
        const initialize = jest.fn();
        const result = loadPlugin(manifest);
        getScript().dispatchEvent(new Event('load'));
        jest.advanceTimersByTime(1000);
        pluginWindow.registerPlugin(manifest.id, {initialize});

        await expect(result).resolves.toBeUndefined();
        expect(initialize).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
    });

    test.each(['error', 'execution', 'timeout'])('keeps a plugin disabled after a %s failure', async (failure) => {
        const result = loadPlugin(manifest);
        const rejected = expect(result).rejects.toThrow(manifest.id);
        const script = getScript();

        if (failure === 'error') {
            script.dispatchEvent(new Event('error'));
        } else if (failure === 'execution') {
            window.dispatchEvent(new ErrorEvent('error', {filename: script.src, error: new Error('ReactCurrentOwner')}));
        } else {
            script.dispatchEvent(new Event('load'));
            jest.advanceTimersByTime(30000);
        }

        await rejected;
        expect(logPluginLoadFailure).toHaveBeenCalledWith(manifest, failure === 'error' ? 'load' : failure, expect.any(Error));
        expect(getScript()).toBeNull();
        expect(jest.getTimerCount()).toBe(0);

        removePlugin(manifest);
        await expect(loadPlugin(manifest)).resolves.toBeUndefined();
        await expect(loadPlugin({...manifest, version: '2.0.0', webapp: {bundle_path: '/static/plugins/startup-test/new.js'}})).resolves.toBeUndefined();
        const initialize = jest.fn();
        pluginWindow.registerPlugin(manifest.id, {initialize});
        expect(initialize).not.toHaveBeenCalled();
        expect(pluginWindow.plugins[manifest.id]).toBeUndefined();
        expect(getScript()).toBeNull();
        expect(jest.getTimerCount()).toBe(0);
        expect(logPluginLoadFailure).toHaveBeenCalledTimes(1);
    });

    test('ignores errors from other scripts', async () => {
        const result = loadPlugin(manifest);
        window.dispatchEvent(new ErrorEvent('error', {filename: 'http://localhost:8065/another.js'}));
        pluginWindow.registerPlugin(manifest.id, {});
        await expect(result).resolves.toBeUndefined();
    });

    test('a superseded load cannot remove the replacement plugin', async () => {
        const first = loadPlugin(manifest);
        const firstScript = getScript();
        const replacement = {...manifest, version: '2.0.0', webapp: {bundle_path: '/static/plugins/startup-test/new.js'}};
        const second = loadPlugin(replacement);
        firstScript.dispatchEvent(new Event('error'));
        await expect(first).resolves.toBeUndefined();

        const initialize = jest.fn();
        pluginWindow.registerPlugin(manifest.id, {initialize});
        await expect(second).resolves.toBeUndefined();
        expect(initialize).toHaveBeenCalledTimes(1);
        expect(getScript()).not.toBeNull();
        expect(logPluginLoadFailure).not.toHaveBeenCalled();
    });

    test('a superseded initializer cannot register handlers after its script fails', async () => {
        let resume!: () => void;
        const paused = new Promise<void>((resolve) => {
            resume = resolve;
        });
        const first = loadPlugin(manifest);
        const firstScript = getScript();
        pluginWindow.registerPlugin(manifest.id, {
            initialize: async (registry) => {
                await paused;
                registry.registerWebSocketEventHandler('stale', jest.fn());
            },
        });

        const replacement = {...manifest, version: '2.0.0', webapp: {bundle_path: '/static/plugins/startup-test/new.js'}};
        const second = loadPlugin(replacement);
        firstScript.dispatchEvent(new Event('error'));
        await first;
        pluginWindow.registerPlugin(manifest.id, {
            initialize: (registry) => registry.registerWebSocketEventHandler('current', jest.fn()),
        });
        await second;
        resume();
        await paused;

        expect(registerPluginWebSocketEvent).toHaveBeenCalledTimes(1);
        expect(registerPluginWebSocketEvent).toHaveBeenCalledWith(manifest.id, 'current', expect.any(Function));
    });

    test('logging dispatch failures cannot leave startup pending', async () => {
        const result = loadPlugin(manifest);
        const rejected = expect(result).rejects.toThrow(manifest.id);
        jest.mocked(store.dispatch).mockImplementationOnce(() => {
            throw new Error('Dispatch failed');
        });
        getScript().dispatchEvent(new Event('error'));
        await rejected;
    });

    test('a queued error cannot remove a successfully initialized plugin', async () => {
        const result = loadPlugin(manifest);
        const script = getScript();
        const onError = script.onerror!;
        pluginWindow.registerPlugin(manifest.id, {});
        await result;
        onError.call(script, new Event('error'));
        expect(getScript()).toBe(script);
        expect(logPluginLoadFailure).not.toHaveBeenCalled();
    });

    test('rejects initialization errors and removes partial registrations', async () => {
        const error = new Error('Plugin initialization failed');
        const result = loadPlugin(manifest);
        const rejected = expect(result).rejects.toMatchObject({cause: error});
        pluginWindow.registerPlugin(manifest.id, {
            initialize: () => {
                throw error;
            },
        });

        await rejected;
        expect(removeWebappPlugin).toHaveBeenCalledWith(manifest);
        expect(logPluginLoadFailure).toHaveBeenCalledWith(manifest, 'initialization', error);
        expect(getScript()).toBeNull();
        expect(pluginWindow.plugins[manifest.id]).toBeUndefined();
        await expect(loadPlugin(manifest)).resolves.toBeUndefined();
        expect(getScript()).toBeNull();
    });

    test('catches asynchronous initialization failures', async () => {
        const error = new Error('Async initialization failed');
        const result = loadPlugin(manifest);
        const rejected = expect(result).rejects.toMatchObject({cause: error});
        pluginWindow.registerPlugin(manifest.id, {initialize: async () => {
            throw error;
        }});
        await rejected;
        expect(logPluginLoadFailure).toHaveBeenCalledWith(manifest, 'initialization', error);
        await expect(loadPlugin(manifest)).resolves.toBeUndefined();
        expect(getScript()).toBeNull();
    });

    test('a timed-out initializer cannot register components or handlers', async () => {
        const pluginStore = createStore(pluginsReducer);
        jest.mocked(store.dispatch).mockImplementation((action: any) => {
            if (action?.type) {
                return pluginStore.dispatch(action);
            }
            return undefined;
        });
        let resume!: () => void;
        const paused = new Promise<void>((resolve) => {
            resume = resolve;
        });
        let initialization!: Promise<void>;
        const result = loadPlugin(manifest);
        const rejected = expect(result).rejects.toThrow('Timed out');
        pluginWindow.registerPlugin(manifest.id, {
            initialize: (registry) => {
                const registerComponent = registry.registerRootComponent;
                initialization = paused.then(() => {
                    registry.registerWebSocketEventHandler('late', jest.fn());
                    registerComponent(() => null);
                });
                return initialization;
            },
        });

        jest.advanceTimersByTime(30000);
        await rejected;
        expect(getScript()).toBeNull();
        expect(pluginWindow.plugins[manifest.id]).toBeUndefined();

        resume();
        await expect(initialization).resolves.toBeUndefined();

        expect(pluginStore.getState().components.Root).toEqual([]);
        expect(registerPluginWebSocketEvent).not.toHaveBeenCalled();
        expect(getScript()).toBeNull();
    });

    test('a callback outside the initialization promise is harmless after timeout', async () => {
        const result = loadPlugin(manifest);
        const rejected = expect(result).rejects.toThrow('Timed out');
        const callback = jest.fn();
        pluginWindow.registerPlugin(manifest.id, {
            initialize: (registry) => {
                const registerComponent = registry.registerRootComponent;
                setTimeout(() => {
                    callback(registerComponent(() => null));
                    registry.registerWebSocketEventHandler('late', jest.fn());
                }, 31000);
                return new Promise(() => {});
            },
        });
        jest.advanceTimersByTime(30000);
        await rejected;
        jest.mocked(store.dispatch).mockClear();

        expect(() => jest.advanceTimersByTime(1000)).not.toThrow();
        expect(callback).toHaveBeenCalledWith(expect.any(String));
        expect(store.dispatch).not.toHaveBeenCalled();
        expect(registerPluginWebSocketEvent).not.toHaveBeenCalled();
    });

    test.each(['uninitialize', 'deinitialize'] as const)('cleans up host handlers when %s throws after initialization fails', async (cleanupMethod) => {
        const error = new Error('Initialization failed');
        const result = loadPlugin(manifest);
        const rejected = expect(result).rejects.toMatchObject({cause: error});
        pluginWindow.registerPlugin(manifest.id, {
            initialize: (registry) => {
                registry.registerWebSocketEventHandler('test', jest.fn());
                throw error;
            },
            [cleanupMethod]: () => {
                throw new Error('Cleanup failed');
            },
        });
        await rejected;

        expect(unregisterAllPluginWebSocketEvents).toHaveBeenCalledWith(manifest.id);
        expect(unregisterPluginReconnectHandler).toHaveBeenCalledWith(manifest.id);
        expect(unregisterAdminConsolePlugin).toHaveBeenCalledWith(manifest.id);
        expect(unregisterPluginTranslationsSource).toHaveBeenCalledWith(manifest.id);
        expect(getScript()).toBeNull();
        expect(pluginWindow.plugins[manifest.id]).toBeUndefined();
    });

    test('a successful plugin can use its registry after initialization and during unload', async () => {
        let registry!: PluginRegistry;
        const result = loadPlugin(manifest);
        const uninitialize = jest.fn(() => registry.unregisterReconnectHandler());
        pluginWindow.registerPlugin(manifest.id, {
            initialize: (pluginRegistry) => {
                registry = pluginRegistry;
            },
            uninitialize,
        });
        await result;

        registry.registerWebSocketEventHandler('later', jest.fn());
        expect(registerPluginWebSocketEvent).toHaveBeenCalledWith(manifest.id, 'later', expect.any(Function));
        expect(() => removePlugin(manifest)).not.toThrow();
        expect(uninitialize).toHaveBeenCalledTimes(1);
        expect(unregisterPluginReconnectHandler).toHaveBeenCalledTimes(2);

        jest.mocked(registerPluginWebSocketEvent).mockClear();
        registry.registerWebSocketEventHandler('after unload', jest.fn());
        expect(registerPluginWebSocketEvent).not.toHaveBeenCalled();
    });
});
