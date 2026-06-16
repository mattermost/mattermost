// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createPluginErrorLog} from './plugin_error_log';

describe('utils/createPluginErrorLog', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('logOnce', () => {
        it('logs on first call for a pluginId', () => {
            const {logOnce} = createPluginErrorLog('TestLabel');
            const err = new Error('boom');

            logOnce('plugin-a', err);

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy.mock.calls[0][0]).toBe(
                "TestLabel: matcher for plugin 'plugin-a' threw — treating as no-match.",
            );
            expect(consoleSpy.mock.calls[0][1]).toBe(err);
        });

        it('does not log on subsequent calls for the same pluginId', () => {
            const {logOnce} = createPluginErrorLog('TestLabel');
            const err = new Error('boom');

            logOnce('plugin-a', err);
            logOnce('plugin-a', err);
            logOnce('plugin-a', err);

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });

        it('logs once per distinct pluginId', () => {
            const {logOnce} = createPluginErrorLog('TestLabel');

            logOnce('plugin-a', new Error('a'));
            logOnce('plugin-b', new Error('b'));
            logOnce('plugin-a', new Error('a2'));

            expect(consoleSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('custom subject/outcome wording', () => {
        it('uses the default matcher wording when no options are given', () => {
            const {logOnce} = createPluginErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'));

            expect(consoleSpy.mock.calls[0][0]).toBe(
                "TestLabel: matcher for plugin 'plugin-a' threw — treating as no-match.",
            );
        });

        it('substitutes subject and outcome in the message', () => {
            const {logOnce} = createPluginErrorLog('ComposerPlaceholder', {
                subject: 'transform',
                outcome: 'using the unmodified placeholder',
            });

            logOnce('plugin-a', new Error('boom'));

            expect(consoleSpy.mock.calls[0][0]).toBe(
                "ComposerPlaceholder: transform for plugin 'plugin-a' threw — using the unmodified placeholder.",
            );
        });
    });

    describe('clear — with pluginId argument', () => {
        it('clears the plugin so its error logs again', () => {
            const {logOnce, clear} = createPluginErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(1);

            clear('plugin-a');

            logOnce('plugin-a', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(2);
        });

        it('does not clear keys belonging to other plugins', () => {
            const {logOnce, clear} = createPluginErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'));
            logOnce('plugin-b', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            clear('plugin-a');

            // plugin-b is still silenced
            logOnce('plugin-b', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            // plugin-a logs again
            logOnce('plugin-a', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(3);
        });

        it('clears an exact pluginId without affecting a longer one (e.g. "foo" vs "foobar")', () => {
            const {logOnce, clear} = createPluginErrorLog('TestLabel');

            logOnce('foo', new Error('boom'));
            logOnce('foobar', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            clear('foo');

            logOnce('foobar', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(2); // foobar still silenced

            logOnce('foo', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(3); // foo logs again
        });
    });

    describe('clear — no argument', () => {
        it('clears all entries so every plugin logs again', () => {
            const {logOnce, clear} = createPluginErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'));
            logOnce('plugin-b', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            clear();

            logOnce('plugin-a', new Error('boom'));
            logOnce('plugin-b', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(4);
        });
    });
});
