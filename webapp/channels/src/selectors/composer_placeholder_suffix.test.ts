// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {ComposerPlaceholderSuffixRegistration} from 'types/store/plugins';

import {clearLoggedSuffixErrors, getComposerPlaceholderSuffix} from './composer_placeholder_suffix';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

function makeIntl(): IntlShape {
    return {
        formatMessage: ({defaultMessage}: {defaultMessage?: string}) => defaultMessage ?? '',
    } as unknown as IntlShape;
}

function makeState(
    suffixes: ComposerPlaceholderSuffixRegistration[] = [],
    channels: Record<string, Channel> = {},
): GlobalState {
    return {
        plugins: {
            components: {
                ComposerPlaceholderSuffix: suffixes,
            },
        },
        entities: {
            channels: {
                channels,
            },
        },
    } as unknown as GlobalState;
}

function makeRegistration(partial: Partial<ComposerPlaceholderSuffixRegistration> = {}): ComposerPlaceholderSuffixRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        matcher: () => true,
        text: ' (encrypted)',
        ...partial,
    };
}

describe('selectors/getComposerPlaceholderSuffix', () => {
    beforeEach(() => {
        clearLoggedSuffixErrors();
    });

    it('returns empty string when there are no registrations', () => {
        const channel = makeChannel();
        const state = makeState([], {[channel.id]: channel});
        expect(getComposerPlaceholderSuffix(state, channel.id, makeIntl())).toBe('');
    });

    it('returns empty string when channelId is empty string', () => {
        const channel = makeChannel();
        const state = makeState([makeRegistration()], {[channel.id]: channel});
        expect(getComposerPlaceholderSuffix(state, '', makeIntl())).toBe('');
    });

    it('returns empty string when channel is not in store', () => {
        const state = makeState([makeRegistration()], {});
        expect(getComposerPlaceholderSuffix(state, 'nonexistent', makeIntl())).toBe('');
    });

    it('returns the suffix for one matching registration with static string', () => {
        const channel = makeChannel();
        const state = makeState(
            [makeRegistration({text: ' (encrypted)'})],
            {[channel.id]: channel},
        );
        expect(getComposerPlaceholderSuffix(state, channel.id, makeIntl())).toBe(' (encrypted)');
    });

    it('calls function text with (channel, state, intl) and returns result', () => {
        const channel = makeChannel();
        const intl = makeIntl();
        const textFn = jest.fn().mockReturnValue(' (fn-result)');
        const state = makeState(
            [makeRegistration({text: textFn})],
            {[channel.id]: channel},
        );
        const result = getComposerPlaceholderSuffix(state, channel.id, intl);
        expect(result).toBe(' (fn-result)');
        expect(textFn).toHaveBeenCalledWith(channel, state, intl);
    });

    it('concatenates suffixes from two matching registrations from different plugins in pluginId alphabetical order', () => {
        const channel = makeChannel();

        // Redux reducer sorts entries by pluginId alphabetically — pass pre-sorted state to mimic that.
        const state = makeState(
            [
                makeRegistration({id: 'reg-a', pluginId: 'aaa-plugin', text: ' (aaa)'}),
                makeRegistration({id: 'reg-z', pluginId: 'zzz-plugin', text: ' (zzz)'}),
            ],
            {[channel.id]: channel},
        );
        expect(getComposerPlaceholderSuffix(state, channel.id, makeIntl())).toBe(' (aaa) (zzz)');
    });

    it('concatenates suffixes from same plugin in insertion order', () => {
        const channel = makeChannel();
        const state = makeState(
            [
                makeRegistration({id: 'reg-1', pluginId: 'test-plugin', text: ' (first)'}),
                makeRegistration({id: 'reg-2', pluginId: 'test-plugin', text: ' (second)'}),
            ],
            {[channel.id]: channel},
        );
        expect(getComposerPlaceholderSuffix(state, channel.id, makeIntl())).toBe(' (first) (second)');
    });

    it('returns empty string for non-matching registration', () => {
        const channel = makeChannel();
        const state = makeState(
            [makeRegistration({matcher: () => false, text: ' (encrypted)'})],
            {[channel.id]: channel},
        );
        expect(getComposerPlaceholderSuffix(state, channel.id, makeIntl())).toBe('');
    });

    it('treats throwing matcher as no-match and logs error once', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const channel = makeChannel();
        const throwingMatcher = () => {
            throw new Error('boom');
        };
        const state = makeState(
            [makeRegistration({pluginId: 'bad-plugin', matcher: throwingMatcher})],
            {[channel.id]: channel},
        );

        const result1 = getComposerPlaceholderSuffix(state, channel.id, makeIntl());
        expect(result1).toBe('');
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        // Second call: error should NOT be logged again
        const result2 = getComposerPlaceholderSuffix(state, channel.id, makeIntl());
        expect(result2).toBe('');
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        consoleSpy.mockRestore();
    });

    it('skips suffix when text function throws and logs error once', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const channel = makeChannel();
        const throwingText = () => {
            throw new Error('text-boom');
        };
        const state = makeState(
            [makeRegistration({pluginId: 'bad-text-plugin', matcher: () => true, text: throwingText})],
            {[channel.id]: channel},
        );

        const result1 = getComposerPlaceholderSuffix(state, channel.id, makeIntl());
        expect(result1).toBe('');
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        // Second call: error should NOT be logged again
        const result2 = getComposerPlaceholderSuffix(state, channel.id, makeIntl());
        expect(result2).toBe('');
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        consoleSpy.mockRestore();
    });
});
