// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMatcherErrorLog} from './matcher_error_log';

describe('utils/createMatcherErrorLog', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    describe('logOnce — no slot (icon-override keying scheme)', () => {
        it('logs on first call for a pluginId', () => {
            const {logOnce} = createMatcherErrorLog('TestLabel');
            const err = new Error('boom');

            logOnce('plugin-a', err);

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy.mock.calls[0][0]).toBe(
                "TestLabel: matcher for plugin 'plugin-a' threw — treating as no-match.",
            );
            expect(consoleSpy.mock.calls[0][1]).toBe(err);
        });

        it('does not log on subsequent calls for the same pluginId', () => {
            const {logOnce} = createMatcherErrorLog('TestLabel');
            const err = new Error('boom');

            logOnce('plugin-a', err);
            logOnce('plugin-a', err);
            logOnce('plugin-a', err);

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });

        it('message has no " at slot" fragment when slot is absent', () => {
            const {logOnce} = createMatcherErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'));

            const msg: string = consoleSpy.mock.calls[0][0];
            expect(msg).not.toContain('at slot');
        });

        it('logs once per distinct pluginId', () => {
            const {logOnce} = createMatcherErrorLog('TestLabel');

            logOnce('plugin-a', new Error('a'));
            logOnce('plugin-b', new Error('b'));
            logOnce('plugin-a', new Error('a2'));

            expect(consoleSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('logOnce — with slot (decorator keying scheme)', () => {
        it('logs on first call for a pluginId+slot pair', () => {
            const {logOnce} = createMatcherErrorLog('TestLabel');
            const err = new Error('boom');

            logOnce('plugin-a', err, 'intro');

            expect(consoleSpy).toHaveBeenCalledTimes(1);
            expect(consoleSpy.mock.calls[0][0]).toBe(
                "TestLabel: matcher for plugin 'plugin-a' at slot 'intro' threw — treating as no-match.",
            );
        });

        it('does not log on subsequent calls for the same pluginId+slot', () => {
            const {logOnce} = createMatcherErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'), 'intro');
            logOnce('plugin-a', new Error('boom'), 'intro');

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });

        it('same pluginId but different slots produce distinct keys and each log once', () => {
            const {logOnce} = createMatcherErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'), 'intro');
            logOnce('plugin-a', new Error('boom'), 'other-slot');

            expect(consoleSpy).toHaveBeenCalledTimes(2);
        });

        it('slot is included in the error message text', () => {
            const {logOnce} = createMatcherErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'), 'some-slot');

            const msg: string = consoleSpy.mock.calls[0][0];
            expect(msg).toContain("at slot 'some-slot'");
        });
    });

    describe('clear — with pluginId argument', () => {
        it('clears the exact-pluginId key (icon scheme) so errors log again', () => {
            const {logOnce, clear} = createMatcherErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(1);

            clear('plugin-a');

            logOnce('plugin-a', new Error('boom'));
            expect(consoleSpy).toHaveBeenCalledTimes(2);
        });

        it('clears pluginId:-prefixed keys (decorator scheme) so errors log again', () => {
            const {logOnce, clear} = createMatcherErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'), 'intro');
            logOnce('plugin-a', new Error('boom'), 'above_composer');
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            clear('plugin-a');

            logOnce('plugin-a', new Error('boom'), 'intro');
            logOnce('plugin-a', new Error('boom'), 'above_composer');
            expect(consoleSpy).toHaveBeenCalledTimes(4);
        });

        it('does not clear keys belonging to other plugins', () => {
            const {logOnce, clear} = createMatcherErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'), 'intro');
            logOnce('plugin-b', new Error('boom'), 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            clear('plugin-a');

            // plugin-b is still silenced
            logOnce('plugin-b', new Error('boom'), 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            // plugin-a logs again
            logOnce('plugin-a', new Error('boom'), 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(3);
        });

        it('guards against prefix collisions (e.g. "foo" vs "foobar")', () => {
            const {logOnce, clear} = createMatcherErrorLog('TestLabel');

            // Both 'foo' and 'foobar' log under their own slots
            logOnce('foo', new Error('boom'), 'intro');
            logOnce('foobar', new Error('boom'), 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            // Clearing 'foo' must NOT clear 'foobar'
            clear('foo');

            logOnce('foobar', new Error('boom'), 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(2); // foobar still silenced

            logOnce('foo', new Error('boom'), 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(3); // foo logs again
        });
    });

    describe('clear — no argument', () => {
        it('clears all entries so every key logs again', () => {
            const {logOnce, clear} = createMatcherErrorLog('TestLabel');

            logOnce('plugin-a', new Error('boom'));
            logOnce('plugin-b', new Error('boom'), 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(2);

            clear();

            logOnce('plugin-a', new Error('boom'));
            logOnce('plugin-b', new Error('boom'), 'intro');
            expect(consoleSpy).toHaveBeenCalledTimes(4);
        });
    });
});
