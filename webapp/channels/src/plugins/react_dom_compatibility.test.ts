// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {LogLevel} from '@mattermost/types/client4';

import {Client4} from 'mattermost-redux/client';

import {wrapReactDOMRoot} from './react_dom_compatibility';

describe('plugin React DOM root logging', () => {
    const OriginalError = Error;
    let enableLogging: boolean;
    let log: jest.SpyInstance;
    let random: jest.SpyInstance;
    let script: HTMLScriptElement;
    let stack: string | undefined;
    let sequence = 0;

    beforeEach(() => {
        enableLogging = Client4.enableLogging;
        Client4.enableLogging = true;
        log = jest.spyOn(Client4, 'logClientError').mockResolvedValue({message: 'logged'});
        random = jest.spyOn(Math, 'random').mockReturnValue(0);
        script = document.createElement('script');
        script.id = `plugin_test-${sequence++}`;
        script.src = `https://example.com/plugins/${script.id}/main.js`;
        script.dataset.pluginVersion = '1.2.3';
        document.head.appendChild(script);
        stack = `Error\n    at join (${script.src}:10:20)`;
        jest.spyOn(global, 'Error').mockImplementation(() => Object.assign(new OriginalError(), {stack}));
    });

    afterEach(() => {
        script.remove();
        Client4.enableLogging = enableLogging;
        jest.restoreAllMocks();
    });

    test.each([
        ['Chrome', 'Error\n    at join (URL:10:20)'],
        ['Firefox', 'join@URL:10:20'],
        ['Safari', 'URL:10:20'],
    ])('attributes %s invocation stacks to the nearest exact script', (_, frame) => {
        const olderScript = script.cloneNode() as HTMLScriptElement;
        olderScript.src += '?older';
        olderScript.dataset.pluginVersion = '1.0.0';
        document.head.prepend(olderScript);
        try {
            stack = `${frame.replace('URL', script.src)}\n    at initialize (${olderScript.src}:1:2)`;
            wrapReactDOMRoot('createRoot', jest.fn())();

            expect(log).toHaveBeenCalledWith(
                `plugin_react_dom_shim_used api=createRoot plugin_id=${script.id.slice(7)} plugin_version=1.2.3`,
                LogLevel.Debug,
            );
        } finally {
            olderScript.remove();
        }
    });

    test('uses unknown for missing frames and misleading URL substrings', () => {
        const original = jest.fn();
        const wrapped = wrapReactDOMRoot('createRoot', original);
        const frames = [
            undefined,
            'Error\n    at app (https://example.com/app.js:1:2)',
            `Error\n    at join (https://other.example/?url=${script.src}:10:20)`,
            `Error\n    at join (https://other.example/?url=(${script.src}:10:20)`,
            `join@${script.src}/extra:10:20`,
            `join@${script.src}?extra:10:20`,
        ];
        for (const frame of frames) {
            stack = frame;
            wrapped();
        }

        expect(original).toHaveBeenCalledTimes(frames.length);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith(
            'plugin_react_dom_shim_used api=createRoot plugin_id=unknown plugin_version=unknown',
            LogLevel.Debug,
        );
    });

    test('uses unknown when the matched script has no version', () => {
        delete script.dataset.pluginVersion;
        wrapReactDOMRoot('createRoot', jest.fn())();
        expect(log).toHaveBeenCalledWith(
            `plugin_react_dom_shim_used api=createRoot plugin_id=${script.id.slice(7)} plugin_version=unknown`,
            LogLevel.Debug,
        );
    });

    test('preserves the receiver, arguments, return value, and synchronous event order', () => {
        const receiver = {};
        const container = {};
        const options = {};
        const root = {};
        const original = jest.fn(function(this: unknown, ...args: unknown[]) {
            expect(this).toBe(receiver);
            expect(args).toEqual([container, options]);
            expect(log).toHaveBeenCalledTimes(1);
            return root;
        });

        expect(wrapReactDOMRoot('createRoot', original).call(receiver, container, options)).toBe(root);
    });

    test.each(['throw', 'reject'])('preserves root results and thrown values when logging can %s', async (failure) => {
        log.mockImplementation(() => {
            if (failure === 'throw') {
                throw new OriginalError('logger failed');
            }
            return Promise.reject(new OriginalError('logger failed'));
        });
        const root = {};
        const thrown = {message: 'invalid container'};
        expect(wrapReactDOMRoot('createRoot', () => root)()).toBe(root);
        const original = jest.fn(() => {
            throw thrown;
        });
        const wrapped = wrapReactDOMRoot('createRoot', original);
        for (let i = 0; i < 2; i++) {
            try {
                wrapped();
                throw new OriginalError('expected root failure');
            } catch (error) {
                expect(error).toBe(thrown);
            }
        }
        await Promise.resolve();

        expect(original).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenCalledTimes(2);
        expect(log).toHaveBeenLastCalledWith(
            `plugin_react_dom_shim_failed api=createRoot plugin_id=${script.id.slice(7)} plugin_version=1.2.3 error=invalid container`,
            LogLevel.Error,
        );
    });

    test('forwards calls and failures when attribution throws', () => {
        jest.spyOn(document, 'querySelectorAll').mockImplementation(() => {
            throw new OriginalError('attribution failed');
        });
        const root = {};
        expect(wrapReactDOMRoot('hydrateRoot', () => root)()).toBe(root);
        const thrown = 'root failed';
        try {
            wrapReactDOMRoot('hydrateRoot', () => {
                throw thrown;
            })();
            throw new OriginalError('expected root failure');
        } catch (error) {
            expect(error).toBe(thrown);
        }
        expect(log).toHaveBeenLastCalledWith(
            'plugin_react_dom_shim_failed api=hydrateRoot plugin_id=unknown plugin_version=unknown error=root failed',
            LogLevel.Error,
        );
    });

    test('deduplicates by event, plugin, original version, and API across wrappers', () => {
        const original = jest.fn();
        const wrapped = wrapReactDOMRoot('createRoot', original);
        wrapped();
        wrapReactDOMRoot('createRoot', original)();
        expect(log).toHaveBeenCalledTimes(1);

        wrapReactDOMRoot('hydrateRoot', original)();
        script.dataset.pluginVersion = '2.0.0\n';
        wrapped();
        script.dataset.pluginVersion = '2.0.0\t';
        wrapped();
        script.id += '-another';
        wrapped();
        expect(log).toHaveBeenCalledTimes(5);
        expect(original).toHaveBeenCalledTimes(6);
    });

    test.each([
        [0.0499, 1],
        [0.05, 0],
    ])('samples usage at the 5%% threshold (%s)', (value, expectedLogs) => {
        random.mockReturnValue(value);
        const root = {};
        const wrapped = wrapReactDOMRoot('createRoot', () => root);

        expect(wrapped()).toBe(root);
        expect(log).toHaveBeenCalledTimes(expectedLogs);
    });

    test.each(['createRoot', 'hydrateRoot'] as const)('does not resample skipped %s usage or suppress failures', (api) => {
        random.mockReturnValueOnce(0.5).mockReturnValue(0);
        const root = {};
        const original = jest.fn(() => root);
        const wrapped = wrapReactDOMRoot(api, original);

        expect(wrapped()).toBe(root);
        expect(wrapped()).toBe(root);
        expect(log).not.toHaveBeenCalled();

        const thrown = new OriginalError('invalid container');
        original.mockImplementation(() => {
            throw thrown;
        });
        expect(wrapped).toThrow(thrown);
        expect(wrapped).toThrow(thrown);

        expect(original).toHaveBeenCalledTimes(4);
        expect(random).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith(
            `plugin_react_dom_shim_failed api=${api} plugin_id=${script.id.slice(7)} plugin_version=1.2.3 error=invalid container`,
            LogLevel.Error,
        );
    });

    test('uses an unknown summary without serializing arbitrary thrown objects', () => {
        const thrown = {toString: jest.fn(), toJSON: jest.fn()};
        try {
            wrapReactDOMRoot('createRoot', () => {
                throw thrown;
            })();
            throw new OriginalError('expected root failure');
        } catch (error) {
            expect(error).toBe(thrown);
        }
        expect(thrown.toString).not.toHaveBeenCalled();
        expect(thrown.toJSON).not.toHaveBeenCalled();
        expect(log).toHaveBeenLastCalledWith(expect.stringContaining(' error=unknown'), LogLevel.Error);
    });

    test('preserves the thrown value when reading its message fails', () => {
        const thrown = Object.defineProperty({}, 'message', {
            get: () => {
                throw new OriginalError('message unavailable');
            },
        });
        try {
            wrapReactDOMRoot('createRoot', () => {
                throw thrown;
            })();
            throw new OriginalError('expected root failure');
        } catch (error) {
            expect(error).toBe(thrown);
        }
    });

    test('disabled logging skips attribution and leaves later calls eligible', () => {
        const query = jest.spyOn(document, 'querySelectorAll');
        const root = {};
        const wrapped = wrapReactDOMRoot('createRoot', () => root);
        Client4.enableLogging = false;
        expect(wrapped()).toBe(root);
        expect(Error).not.toHaveBeenCalled();
        expect(query).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();

        Client4.enableLogging = true;
        expect(wrapped()).toBe(root);
        expect(log).toHaveBeenCalledTimes(1);
    });

    test('cleans and limits the complete message, retaining marker, API, and plugin ID first', () => {
        script.dataset.pluginVersion = `1.2.3\nβ${'v'.repeat(250)}`;
        const thrown = {message: `bad\n容器${'x'.repeat(500)}`};
        const pluginId = script.id.slice(7);
        try {
            wrapReactDOMRoot('createRoot', () => {
                script.dataset.pluginVersion = 'changed-during-call';
                throw thrown;
            })();
            throw new OriginalError('expected root failure');
        } catch (error) {
            expect(error).toBe(thrown);
        }

        expect(log).toHaveBeenCalledTimes(2);
        for (const [message] of log.mock.calls) {
            expect(message).toMatch(/^[\x20-\x7E]+$/);
            expect(message.length).toBeLessThanOrEqual(399);
            expect(message).toContain(`api=createRoot plugin_id=${pluginId} plugin_version=1.2.3  `);
            expect(message).not.toContain('changed-during-call');
        }
        expect(log.mock.calls[1][0]).toMatch(/^plugin_react_dom_shim_failed api=createRoot plugin_id=/);
        expect(log.mock.calls[1][0]).toContain(' error=bad   ');
        expect(log.mock.calls[1][0]).toHaveLength(399);
        expect(log.mock.calls[1][1]).toBe(LogLevel.Error);
    });
});
