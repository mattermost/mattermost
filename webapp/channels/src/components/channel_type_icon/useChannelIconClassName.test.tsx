// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Channel} from '@mattermost/types/channels';

import {renderHookWithContext} from 'tests/react_testing_utils';

import {useChannelIconClassName} from './useChannelIconClassName';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

describe('hooks/useChannelIconClassName', () => {
    it('returns icon-globe for an open channel with no overrides', () => {
        const {result} = renderHookWithContext(
            () => useChannelIconClassName(makeChannel({type: 'O'})),
            {plugins: {components: {ChannelIconOverride: []}}} as any,
        );
        expect(result.current).toBe('icon-globe');
    });

    it('returns icon-lock-outline for a private channel with no overrides', () => {
        const {result} = renderHookWithContext(
            () => useChannelIconClassName(makeChannel({type: 'P'})),
            {plugins: {components: {ChannelIconOverride: []}}} as any,
        );
        expect(result.current).toBe('icon-lock-outline');
    });

    it('returns icon-globe when channel is undefined', () => {
        const {result} = renderHookWithContext(
            () => useChannelIconClassName(undefined),
            {plugins: {components: {ChannelIconOverride: []}}} as any,
        );
        expect(result.current).toBe('icon-globe');
    });

    it('returns the override icon class when a matcher matches', () => {
        const channel = makeChannel({type: 'O'});
        const {result} = renderHookWithContext(
            () => useChannelIconClassName(channel),
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
        expect(result.current).toBe('icon-shield-outline');
    });
});
