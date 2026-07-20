// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';

import type {GlobalState} from 'types/store';
import type {ComposerPlaceholderRegistration} from 'types/store/plugins';

import {clearComposerPlaceholderErrors, getComposerPlaceholder} from './composer_placeholder';

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
    registrations: ComposerPlaceholderRegistration[] = [],
    channels: Record<string, Channel> = {},
): GlobalState {
    return {
        plugins: {
            components: {
                ComposerPlaceholder: registrations,
            },
        },
        entities: {
            channels: {
                channels,
            },
        },
    } as unknown as GlobalState;
}

function makeRegistration(partial: Partial<ComposerPlaceholderRegistration> = {}): ComposerPlaceholderRegistration {
    return {
        id: 'reg-1',
        pluginId: 'test-plugin',
        transform: (placeholder) => `${placeholder} (encrypted)`,
        ...partial,
    };
}

describe('components/advanced_text_editor/getComposerPlaceholder', () => {
    const base = 'Write to Test Channel';

    beforeEach(() => {
        clearComposerPlaceholderErrors();
    });

    it('returns the base placeholder when there are no registrations', () => {
        const channel = makeChannel();
        const state = makeState([], {[channel.id]: channel});
        expect(getComposerPlaceholder(state, channel.id, base, makeIntl())).toBe(base);
    });

    it('returns the base placeholder when channelId is empty', () => {
        const channel = makeChannel();
        const state = makeState([makeRegistration()], {[channel.id]: channel});
        expect(getComposerPlaceholder(state, '', base, makeIntl())).toBe(base);
    });

    it('returns the base placeholder when the channel is not in store', () => {
        const state = makeState([makeRegistration()], {});
        expect(getComposerPlaceholder(state, 'nonexistent', base, makeIntl())).toBe(base);
    });

    it('appends a suffix when a transform appends to the placeholder', () => {
        const channel = makeChannel();
        const state = makeState([makeRegistration()], {[channel.id]: channel});
        expect(getComposerPlaceholder(state, channel.id, base, makeIntl())).toBe('Write to Test Channel (encrypted)');
    });

    it('lets a transform replace the placeholder entirely', () => {
        const channel = makeChannel();
        const state = makeState(
            [makeRegistration({transform: () => 'Replaced'})],
            {[channel.id]: channel},
        );
        expect(getComposerPlaceholder(state, channel.id, base, makeIntl())).toBe('Replaced');
    });

    it('calls transform with (placeholder, channel, state, intl)', () => {
        const channel = makeChannel();
        const intl = makeIntl();
        const transform = jest.fn().mockReturnValue('result');
        const state = makeState([makeRegistration({transform})], {[channel.id]: channel});

        expect(getComposerPlaceholder(state, channel.id, base, intl)).toBe('result');
        expect(transform).toHaveBeenCalledWith(base, channel, state, intl);
    });

    it('chains transforms from different plugins in pluginId alphabetical order', () => {
        const channel = makeChannel();

        // The reducer sorts entries by pluginId; pass pre-sorted state to mimic that. Each transform
        // receives the previous result, so the running order is observable in the output.
        const state = makeState(
            [
                makeRegistration({id: 'reg-a', pluginId: 'aaa-plugin', transform: (p) => `${p} (aaa)`}),
                makeRegistration({id: 'reg-z', pluginId: 'zzz-plugin', transform: (p) => `${p} (zzz)`}),
            ],
            {[channel.id]: channel},
        );
        expect(getComposerPlaceholder(state, channel.id, base, makeIntl())).toBe('Write to Test Channel (aaa) (zzz)');
    });

    it('chains transforms from the same plugin in insertion order', () => {
        const channel = makeChannel();
        const state = makeState(
            [
                makeRegistration({id: 'reg-1', pluginId: 'test-plugin', transform: (p) => `${p} (first)`}),
                makeRegistration({id: 'reg-2', pluginId: 'test-plugin', transform: (p) => `${p} (second)`}),
            ],
            {[channel.id]: channel},
        );
        expect(getComposerPlaceholder(state, channel.id, base, makeIntl())).toBe('Write to Test Channel (first) (second)');
    });

    it('leaves the placeholder unmodified when a transform returns a non-string', () => {
        const channel = makeChannel();
        const state = makeState(
            [makeRegistration({transform: (() => undefined) as unknown as ComposerPlaceholderRegistration['transform']})],
            {[channel.id]: channel},
        );
        expect(getComposerPlaceholder(state, channel.id, base, makeIntl())).toBe(base);
    });

    it('treats a throwing transform as a no-op and logs the error once', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const channel = makeChannel();
        const throwingTransform = () => {
            throw new Error('boom');
        };
        const state = makeState(
            [makeRegistration({pluginId: 'bad-plugin', transform: throwingTransform})],
            {[channel.id]: channel},
        );

        expect(getComposerPlaceholder(state, channel.id, base, makeIntl())).toBe(base);
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        // Second call: error should NOT be logged again.
        expect(getComposerPlaceholder(state, channel.id, base, makeIntl())).toBe(base);
        expect(consoleSpy).toHaveBeenCalledTimes(1);

        consoleSpy.mockRestore();
    });

    it('continues chaining after a throwing transform', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const channel = makeChannel();
        const throwingTransform = () => {
            throw new Error('boom');
        };
        const state = makeState(
            [
                makeRegistration({id: 'reg-a', pluginId: 'aaa-plugin', transform: throwingTransform}),
                makeRegistration({id: 'reg-z', pluginId: 'zzz-plugin', transform: (p) => `${p} (zzz)`}),
            ],
            {[channel.id]: channel},
        );

        expect(getComposerPlaceholder(state, channel.id, base, makeIntl())).toBe('Write to Test Channel (zzz)');

        consoleSpy.mockRestore();
    });
});
