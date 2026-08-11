// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {clearLoggedMatcherErrors} from './channel_icon_override';
import {useChannelIconOverrideName} from './useChannelIconOverrideName';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

describe('hooks/useChannelIconOverrideName', () => {
    beforeEach(() => {
        clearLoggedMatcherErrors();
    });

    it('returns null when channel is undefined', () => {
        const {result} = renderHookWithContext(
            () => useChannelIconOverrideName(undefined),
            {plugins: {components: {ChannelIconOverride: []}}} as any,
        );
        expect(result.current).toBeNull();
    });

    it('returns null for a channel with no overrides', () => {
        const {result} = renderHookWithContext(
            () => useChannelIconOverrideName(makeChannel({type: 'O'})),
            {plugins: {components: {ChannelIconOverride: []}}} as any,
        );
        expect(result.current).toBeNull();
    });

    it('returns iconName when a matcher matches', () => {
        const channel = makeChannel({type: 'O'});
        const {result} = renderHookWithContext(
            () => useChannelIconOverrideName(channel),
            {
                plugins: {
                    components: {
                        ChannelIconOverride: [
                            {id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'},
                        ],
                    },
                },
            } as any,
        );
        expect(result.current).toBe('shield-outline');
    });

    it('returns null when matcher returns false', () => {
        const channel = makeChannel({type: 'O'});
        const {result} = renderHookWithContext(
            () => useChannelIconOverrideName(channel),
            {
                plugins: {
                    components: {
                        ChannelIconOverride: [
                            {id: '1', pluginId: 'mbe', matcher: () => false, iconName: 'shield-outline'},
                        ],
                    },
                },
            } as any,
        );
        expect(result.current).toBeNull();
    });

    it('returns null when matcher throws', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const channel = makeChannel({type: 'O'});
        const {result} = renderHookWithContext(
            () => useChannelIconOverrideName(channel),
            {
                plugins: {
                    components: {
                        ChannelIconOverride: [
                            {
                                id: '1',
                                pluginId: 'hook-bad-plugin',
                                matcher: () => {
                                    throw new Error('boom');
                                },
                                iconName: 'shield-outline',
                            },
                        ],
                    },
                },
            } as any,
        );
        expect(result.current).toBeNull();
        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0][0]).toContain("ChannelIconOverride: matcher for plugin 'hook-bad-plugin' threw — treating as no-match.");
        consoleSpy.mockRestore();
    });
});
