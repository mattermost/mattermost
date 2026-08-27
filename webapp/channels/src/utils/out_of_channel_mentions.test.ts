// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';

import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import {
    extractUserMentionsFromMessage,
    getOutOfChannelMentionsFromMessage,
} from './out_of_channel_mentions';

describe('out_of_channel_mentions', () => {
    describe('extractUserMentionsFromMessage', () => {
        it('extracts usernames from message', () => {
            expect(extractUserMentionsFromMessage('hello @alice and @bob')).toEqual(['alice', 'bob']);
        });

        it('skips special mentions', () => {
            expect(extractUserMentionsFromMessage('@channel @here @all @alice')).toEqual(['alice']);
        });

        it('deduplicates usernames', () => {
            expect(extractUserMentionsFromMessage('@alice @alice')).toEqual(['alice']);
        });
    });

    describe('getOutOfChannelMentionsFromMessage', () => {
        const channelId = 'channel_id';
        const teamId = 'team_id';
        const channel = TestHelper.getChannelMock({
            id: channelId,
            team_id: teamId,
        });

        function getStateWithPermissions(): DeepPartial<GlobalState> {
            return {
                entities: {
                    channels: {
                        channels: {
                            [channelId]: channel,
                        },
                        roles: {},
                        groupsAssociatedToChannel: {},
                    },
                    groups: {
                        groups: {},
                    },
                    teams: {
                        currentTeamId: teamId,
                        teams: {
                            [teamId]: TestHelper.getTeamMock({id: teamId}),
                        },
                        groupsAssociatedToTeam: {},
                    },
                    users: {
                        currentUserId: 'current_user_id',
                        profiles: {
                            current_user_id: TestHelper.getUserMock({
                                id: 'current_user_id',
                                roles: 'system_admin',
                            }),
                            user1: TestHelper.getUserMock({id: 'user1', username: 'alice'}),
                        },
                        profilesInChannel: {
                            [channelId]: new Set(['current_user_id']),
                        },
                        profilesNotInChannel: {
                            [channelId]: new Set(['user1']),
                        },
                        profilesInTeam: {
                            [teamId]: new Set(['user1', 'current_user_id']),
                        },
                    },
                    roles: {
                        roles: {
                            system_admin: {
                                permissions: [
                                    Permissions.MANAGE_PUBLIC_CHANNEL_MEMBERS,
                                ],
                            },
                            system_user: {
                                permissions: [],
                            },
                        },
                    },
                },
            };
        }

        it('returns null when user cannot manage members', async () => {
            const state = getStateWithPermissions();
            state.entities!.users!.profiles!.current_user_id!.roles = 'system_user';

            const dispatch = jest.fn();
            const result = await getOutOfChannelMentionsFromMessage(
                state as GlobalState,
                dispatch,
                channel,
                '@alice hello',
            );

            expect(result).toBeNull();
            expect(dispatch).not.toHaveBeenCalled();
        });

        it('returns addable users cached as not in channel', async () => {
            const dispatch = jest.fn();
            const result = await getOutOfChannelMentionsFromMessage(
                getStateWithPermissions() as GlobalState,
                dispatch,
                channel,
                '@alice hello',
            );

            expect(result).toEqual({
                addable: [expect.objectContaining({id: 'user1', username: 'alice'})],
                notAddable: [],
                outOfTeam: [],
            });
            expect(dispatch).not.toHaveBeenCalled();
        });

        it('classifies autocomplete out_of_channel users as addable', async () => {
            const outOfChannelUser = TestHelper.getUserMock({id: 'user2', username: 'bob'});
            const dispatch = jest.fn().mockResolvedValue({
                data: {
                    users: [],
                    out_of_channel: [outOfChannelUser],
                },
            });

            const state = getStateWithPermissions();
            const result = await getOutOfChannelMentionsFromMessage(
                state as GlobalState,
                dispatch,
                channel,
                '@bob hello',
            );

            expect(result).toEqual({
                addable: [expect.objectContaining({id: 'user2', username: 'bob'})],
                notAddable: [],
                outOfTeam: [],
            });
            expect(dispatch).toHaveBeenCalled();
        });

        it('returns null when only out-of-team users are mentioned', async () => {
            const dispatch = jest.fn().mockResolvedValue({
                data: {
                    users: [],
                    out_of_channel: [],
                },
            });

            const state = getStateWithPermissions();
            state.entities!.users!.profiles!.user3 = TestHelper.getUserMock({id: 'user3', username: 'carol'});
            state.entities!.users!.profilesInTeam = {
                [teamId]: new Set(['user1', 'current_user_id']),
            };

            const result = await getOutOfChannelMentionsFromMessage(
                state as GlobalState,
                dispatch,
                channel,
                '@carol hello',
            );

            expect(result).toBeNull();
        });
    });
});
