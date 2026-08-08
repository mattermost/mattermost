// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    getSuppressOutOfChannelEphemeral,
    getSuppressOutOfChannelEphemeralKey,
    isOutOfChannelMentionEphemeralPost,
    OUT_OF_CHANNEL_EPHEMERAL_SUPPRESS_TTL_MS,
    shouldSuppressOutOfChannelEphemeralPost,
    suppressOutOfChannelEphemeralPost,
} from 'actions/views/out_of_channel_mention';

import {ActionTypes} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

describe('out_of_channel_mention actions', () => {
    describe('suppressOutOfChannelEphemeralPost', () => {
        it('dispatches suppress action with expiry', () => {
            const dispatch = jest.fn();
            const now = Date.now();
            jest.spyOn(Date, 'now').mockReturnValue(now);

            suppressOutOfChannelEphemeralPost('channel_id', 'root_id')(dispatch, jest.fn(), undefined);

            expect(dispatch).toHaveBeenCalledWith({
                type: ActionTypes.SUPPRESS_OUT_OF_CHANNEL_EPHEMERAL,
                data: {
                    channelId: 'channel_id',
                    rootId: 'root_id',
                    expireAt: now + OUT_OF_CHANNEL_EPHEMERAL_SUPPRESS_TTL_MS,
                },
            });
        });
    });

    describe('shouldSuppressOutOfChannelEphemeralPost', () => {
        const suppressExpireAt = Date.now() + 5000;
        const baseState = {
            entities: {
                users: {
                    currentUserId: 'current_user_id',
                },
            },
            views: {
                posts: {
                    suppressOutOfChannelEphemeral: {
                        [getSuppressOutOfChannelEphemeralKey('channel_id', 'root_id')]: {
                            expireAt: suppressExpireAt,
                        },
                    },
                },
            },
        } as GlobalState;

        it('suppresses out-of-channel mention ephemerals with add_channel_member props', () => {
            const post = TestHelper.getPostMock({
                user_id: '',
                channel_id: 'channel_id',
                root_id: 'root_id',
                type: 'system_ephemeral',
                props: {
                    add_channel_member: {
                        post_id: 'ephemeral_post_id',
                        not_in_channel_user_ids: ['user1'],
                        not_in_channel_usernames: ['alice'],
                        not_in_groups_usernames: [],
                    },
                },
            });

            expect(isOutOfChannelMentionEphemeralPost(post)).toBe(true);
            expect(shouldSuppressOutOfChannelEphemeralPost(baseState, post)).toBe(true);
        });

        it('suppresses multiple out-of-channel mention ephemerals while the flag is active', () => {
            const firstOutOfChannelPost = TestHelper.getPostMock({
                channel_id: 'channel_id',
                root_id: 'root_id',
                type: 'system_ephemeral',
                props: {
                    add_channel_member: {
                        post_id: 'ephemeral_post_id_1',
                        not_in_channel_user_ids: ['user1'],
                        not_in_channel_usernames: ['alice'],
                        not_in_groups_usernames: [],
                    },
                },
            });
            const secondOutOfChannelPost = TestHelper.getPostMock({
                channel_id: 'channel_id',
                root_id: 'root_id',
                type: 'system_ephemeral',
                props: {
                    add_channel_member: {
                        post_id: 'ephemeral_post_id_2',
                        not_in_channel_user_ids: ['user2'],
                        not_in_channel_usernames: ['bob'],
                        not_in_groups_usernames: ['carol'],
                    },
                },
            });

            expect(shouldSuppressOutOfChannelEphemeralPost(baseState, firstOutOfChannelPost)).toBe(true);
            expect(shouldSuppressOutOfChannelEphemeralPost(baseState, secondOutOfChannelPost)).toBe(true);
        });

        it('does not suppress unrelated ephemerals', () => {
            const slashCommandEphemeral = TestHelper.getPostMock({
                channel_id: 'channel_id',
                root_id: 'root_id',
                type: 'system_ephemeral',
                message: 'Available commands: /away',
            });
            const outOfTeamPost = TestHelper.getPostMock({
                channel_id: 'channel_id',
                root_id: 'root_id',
                type: 'system_ephemeral',
                message: '@alice did not get notified by this mention because they are not a member of this team.',
            });

            expect(shouldSuppressOutOfChannelEphemeralPost(baseState, slashCommandEphemeral)).toBe(false);
            expect(shouldSuppressOutOfChannelEphemeralPost(baseState, outOfTeamPost)).toBe(false);
        });

        it('does not suppress non-ephemeral posts', () => {
            const post = TestHelper.getPostMock({
                channel_id: 'channel_id',
                root_id: 'root_id',
            });

            expect(shouldSuppressOutOfChannelEphemeralPost(baseState, post)).toBe(false);
        });

        it('does not suppress when flag expired', () => {
            const state = {
                ...baseState,
                views: {
                    posts: {
                        suppressOutOfChannelEphemeral: {
                            [getSuppressOutOfChannelEphemeralKey('channel_id', 'root_id')]: {
                                expireAt: Date.now() - 1,
                            },
                        },
                    },
                },
            } as GlobalState;

            const post = TestHelper.getPostMock({
                channel_id: 'channel_id',
                root_id: 'root_id',
                type: 'system_ephemeral',
                props: {
                    add_channel_member: {
                        post_id: 'ephemeral_post_id',
                        not_in_channel_user_ids: ['user1'],
                        not_in_channel_usernames: ['alice'],
                        not_in_groups_usernames: [],
                    },
                },
            });

            expect(shouldSuppressOutOfChannelEphemeralPost(state, post)).toBe(false);
            expect(getSuppressOutOfChannelEphemeral(state, 'channel_id', 'root_id')).toBeNull();
        });

        it('keeps suppressions for multiple channel and thread keys', () => {
            const state = {
                ...baseState,
                views: {
                    posts: {
                        suppressOutOfChannelEphemeral: {
                            [getSuppressOutOfChannelEphemeralKey('channel_id', 'root_id')]: {
                                expireAt: suppressExpireAt,
                            },
                            [getSuppressOutOfChannelEphemeralKey('channel_id', '')]: {
                                expireAt: suppressExpireAt,
                            },
                            [getSuppressOutOfChannelEphemeralKey('other_channel_id', '')]: {
                                expireAt: suppressExpireAt,
                            },
                        },
                    },
                },
            } as GlobalState;

            expect(getSuppressOutOfChannelEphemeral(state, 'channel_id', 'root_id')).not.toBeNull();
            expect(getSuppressOutOfChannelEphemeral(state, 'channel_id', '')).not.toBeNull();
            expect(getSuppressOutOfChannelEphemeral(state, 'other_channel_id', '')).not.toBeNull();
            expect(getSuppressOutOfChannelEphemeral(state, 'other_channel_id', 'root_id')).toBeNull();
        });
    });
});
