// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {draftMatchesDestination} from './draft';

describe('types/store/draft', () => {
    describe('draftMatchesDestination', () => {
        it('returns true when channel and thread match', () => {
            expect(draftMatchesDestination(
                {channelId: 'channel_a', rootId: 'thread_a'},
                {channelId: 'channel_a', rootId: 'thread_a'},
            )).toBe(true);
        });

        it('returns false when channel or thread differ', () => {
            expect(draftMatchesDestination(
                {channelId: 'channel_a', rootId: ''},
                {channelId: 'channel_b', rootId: ''},
            )).toBe(false);

            expect(draftMatchesDestination(
                {channelId: 'channel_a', rootId: 'thread_a'},
                {channelId: 'channel_a', rootId: 'thread_b'},
            )).toBe(false);
        });
    });
});
