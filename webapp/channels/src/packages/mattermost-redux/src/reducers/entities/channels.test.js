// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChannelTypes, UserTypes, PostTypes, AdminTypes} from 'mattermost-redux/action_types';
import TestHelper from 'mattermost-redux/test/test_helper';
import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {General, Permissions} from 'mattermost-redux/constants';

import channelsReducer, * as Reducers from './channels';

describe('channels', () => {
    describe('RECEIVED_CHANNEL_DELETED', () => {
        test('should mark channel as deleted', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL_DELETED,
                data: {
                    id: 'channel1',
                    deleteAt: 1000,
                },
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                delete_at: 1000,
            });
            expect(nextState.channels.channel2).toBe(state.channels.channel2);
        });

        test('should do nothing for a channel that is not loaded', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL_DELETED,
                data: {
                    id: 'channel3',
                    deleteAt: 1000,
                },
            });

            expect(nextState).toBe(state);
        });
    });

    describe('RECEIVED_CHANNEL_UNARCHIVED', () => {
        test('should mark channel as active', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        delete_at: 1000,
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL_UNARCHIVED,
                data: {
                    id: 'channel1',
                },
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                delete_at: 0,
            });
            expect(nextState.channels.channel2).toBe(state.channels.channel2);
        });

        test('should do nothing for a channel that is not loaded', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL_UNARCHIVED,
                data: {
                    id: 'channel3',
                },
            });

            expect(nextState).toBe(state);
        });
    });

    describe('INCREMENT_FILE_COUNT', () => {
        test('should change channel file count stats', () => {
            const state = deepFreeze(channelsReducer({
                stats: {
                    channel1: {
                        id: 'channel1',
                        files_count: 1,
                    },
                },
            }, {}));
            const nextState = channelsReducer(state, {
                type: ChannelTypes.INCREMENT_FILE_COUNT,
                id: 'channel1',
                amount: 3,
            });

            expect(nextState).not.toBe(state);
            expect(nextState.stats.channel1.files_count).toEqual(4);
        });
    });

    describe('UPDATE_CHANNEL_HEADER', () => {
        test('should update channel header', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        header: 'old',
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.UPDATE_CHANNEL_HEADER,
                data: {
                    channelId: 'channel1',
                    header: 'new',
                },
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                header: 'new',
            });
            expect(nextState.channels.channel2).toBe(state.channels.channel2);
        });

        test('should do nothing for a channel that is not loaded', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        header: 'old',
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.UPDATE_CHANNEL_HEADER,
                data: {
                    channelId: 'channel3',
                    header: 'new',
                },
            });

            expect(nextState).toBe(state);
        });
    });

    describe('UPDATE_CHANNEL_PURPOSE', () => {
        test('should update channel purpose', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        purpose: 'old',
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.UPDATE_CHANNEL_PURPOSE,
                data: {
                    channelId: 'channel1',
                    purpose: 'new',
                },
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                purpose: 'new',
            });
            expect(nextState.channels.channel2).toBe(state.channels.channel2);
        });

        test('should do nothing for a channel that is not loaded', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        header: 'old',
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.UPDATE_CHANNEL_PURPOSE,
                data: {
                    channelId: 'channel3',
                    purpose: 'new',
                },
            });

            expect(nextState).toBe(state);
        });
    });

    describe('REMOVE_MEMBER_FROM_CHANNEL', () => {
        test('should remove the channel member', () => {
            const state = deepFreeze(channelsReducer({
                membersInChannel: {
                    channel1: {
                        memberId1: 'member-data-1',
                    },
                    channel2: {
                        memberId2: 'member-data-2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.REMOVE_MEMBER_FROM_CHANNEL,
                data: {
                    id: 'channel2',
                    user_id: 'memberId2',
                },
            });

            expect(nextState.membersInChannel.channel2).toEqual({});
            expect(nextState.membersInChannel.channel1).toEqual(state.membersInChannel.channel1);
        });

        test('should work when channel member doesn\'t exist', () => {
            const state = deepFreeze(channelsReducer({
                membersInChannel: {
                    channel1: {
                        memberId1: 'member-data-1',
                    },
                    channel2: {
                        memberId2: 'member-data-2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.REMOVE_MEMBER_FROM_CHANNEL,
                data: {
                    id: 'channel2',
                    user_id: 'test',
                },
            });

            expect(nextState).toEqual(state);
        });

        test('should work when channel doesn\'t exist', () => {
            const state = deepFreeze(channelsReducer({
                membersInChannel: {
                    channel1: {
                        memberId1: 'member-data-1',
                    },
                    channel2: {
                        memberId2: 'member-data-2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.REMOVE_MEMBER_FROM_CHANNEL,
                data: {
                    id: 'channel3',
                    user_id: 'memberId2',
                },
            });

            expect(nextState).toEqual(state);
        });
    });

    describe('RECEIVED_NEW_POST', () => {
        test('should update channel last_post_at', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        last_post_at: 1234,
                        last_root_post_at: 1234,
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: PostTypes.RECEIVED_NEW_POST,
                data: {
                    channel_id: 'channel1',
                    create_at: 1235,
                    root_id: '',
                },
                features: {crtEnabled: false},
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                last_post_at: 1235,
                last_root_post_at: 1235,
            });
            expect(nextState.channels.channel2).toBe(state.channels.channel2);
        });

        test('should not update channel last_root_post_at for threads with crtEnabled', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        last_post_at: 1234,
                        last_root_post_at: 1234,
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: PostTypes.RECEIVED_NEW_POST,
                data: {
                    channel_id: 'channel1',
                    create_at: 1235,
                    root_id: 'post1',
                },
                features: {crtEnabled: true},
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                last_post_at: 1235,
                last_root_post_at: 1234,
            });
            expect(nextState.channels.channel2).toBe(state.channels.channel2);
        });
        test('should do nothing for a channel that is not loaded', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: PostTypes.RECEIVED_NEW_POST,
                data: {
                    id: 'channel3',
                },
            });

            expect(nextState).toBe(state);
        });

        test('should not update channel last_post_at if existing value is greater than new post timestamp', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        last_post_at: 1237,
                        last_root_post_at: 1236,
                    },
                    channel2: {
                        id: 'channel2',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: PostTypes.RECEIVED_NEW_POST,
                data: {
                    channel_id: 'channel1',
                    create_at: 1235,
                },
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                last_post_at: 1237,
                last_root_post_at: 1236,
            });
            expect(nextState.channels.channel2).toBe(state.channels.channel2);
        });
    });

    describe('MANUALLY_UNREAD', () => {
        test('should mark channel as manually unread', () => {
            const state = deepFreeze({
                channel1: false,
            });
            const nextState = Reducers.manuallyUnread(state, {
                type: ChannelTypes.POST_UNREAD_SUCCESS,
                data: {channelId: 'channel1'},
            });
            expect(nextState.channel1).toBe(true);
        });
        test('should mark channel as manually unread even if undefined', () => {
            const state = deepFreeze({
            });
            const nextState = Reducers.manuallyUnread(state, {
                type: ChannelTypes.POST_UNREAD_SUCCESS,
                data: {channelId: 'channel1'},
            });
            expect(nextState.channel1).toBe(true);
        });
        test('should remove channel as manually unread', () => {
            const state = deepFreeze({
                channel1: true,
            });
            const nextState = Reducers.manuallyUnread(state, {
                type: ChannelTypes.REMOVE_MANUALLY_UNREAD,
                data: {channelId: 'channel1'},
            });
            expect(nextState.channel1).toBe(undefined);
        });
        test('shouldn\'t do nothing if channel was undefined', () => {
            const state = deepFreeze({
            });
            const nextState = Reducers.manuallyUnread(state, {
                type: ChannelTypes.REMOVE_MANUALLY_UNREAD,
                data: {channelId: 'channel1'},
            });
            expect(nextState.channel1).toBe(undefined);
        });
        test('remove all marks if user logs out', () => {
            const state = deepFreeze({
                channel1: true,
                channel231: false,
            });
            const nextState = Reducers.manuallyUnread(state, {
                type: UserTypes.LOGOUT_SUCCESS,
                data: {},
            });
            expect(nextState.channel1).toBe(undefined);
            expect(nextState.channel231).toBe(undefined);
        });
    });

    describe('RECEIVED_CHANNEL', () => {
        test('should not store message count sent by server', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                    },
                },
            }, {}));

            let nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: {
                    id: 'channel1',
                    total_msg_count: 123,
                    total_msg_count_root: 456,
                },
            });

            expect(nextState.channels).toEqual({
                channel1: {
                    id: 'channel1',
                },
            });

            nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL,
                data: {
                    id: 'channel2',
                    total_msg_count: 123,
                    total_msg_count_root: 456,
                },
            });

            expect(nextState.channels).toEqual({
                channel1: {
                    id: 'channel1',
                },
                channel2: {
                    id: 'channel2',
                },
            });
        });
    });

    describe('RECEIVED_CHANNELS', () => {
        test('should not remove current channel', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team',
                    },
                    channel2: {
                        id: 'channel2',
                        team_id: 'team',
                    },
                    channel3: {
                        id: 'channel3',
                        team_id: 'team',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNELS,
                currentChannelId: 'channel3',
                teamId: 'team',
                data: [{
                    id: 'channel1',
                    team_id: 'team',
                }],
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                team_id: 'team',
            });
            expect(nextState.channels.channel2).toEqual({
                id: 'channel2',
                team_id: 'team',
            });
            expect(nextState.channels.channel3).toEqual({
                id: 'channel3',
                team_id: 'team',
            });
        });

        test('should preserve existing display_name if none incoming on DMs', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    no_display_name: {
                        id: 'no_display_name',
                        team_id: 'team',
                        type: General.DM_CHANNEL,
                    },
                    empty_display_name: {
                        id: 'empty_display_name',
                        team_id: 'team',
                        display_name: '', // empty display name
                        type: General.DM_CHANNEL,
                    },
                    existing_display_name: {
                        id: 'existing_display_name',
                        team_id: 'team',
                        display_name: 'existing',
                        type: General.DM_CHANNEL,
                    },
                    replaced_display_name: {
                        id: 'new_display_name',
                        team_id: 'team',
                        display_name: 'existing',
                        type: General.DM_CHANNEL,
                    },
                    not_a_dm: {
                        id: 'not_a_dm',
                        team_id: 'team',
                        display_name: 'not a dm, replaced',
                        type: General.GM_CHANNEL,
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, deepFreeze({
                type: ChannelTypes.RECEIVED_CHANNELS,
                currentChannelId: 'existing_display_name',
                teamId: 'team',
                data: [
                    {
                        id: 'no_display_name',
                        team_id: 'team',
                        display_name: 'new for no_display_name',
                        type: General.DM_CHANNEL,
                    },
                    {
                        id: 'empty_display_name',
                        team_id: 'team',
                        display_name: 'new for empty_display_name',
                        type: General.DM_CHANNEL,
                    },
                    {
                        id: 'existing_display_name',
                        team_id: 'team',
                        type: General.DM_CHANNEL,
                    },
                    {
                        id: 'new_display_name',
                        team_id: 'team',
                        display_name: 'new for new_display_name',
                        type: General.DM_CHANNEL,
                    },
                    {
                        id: 'not_a_dm',
                        team_id: 'team',
                        display_name: 'new for not_a_dm',
                        type: General.GM_CHANNEL,
                    },
                ],
            }));

            expect(nextState).not.toBe(state);
            expect(nextState.channels.no_display_name).toEqual({
                id: 'no_display_name',
                team_id: 'team',
                display_name: 'new for no_display_name',
                type: General.DM_CHANNEL,
            });
            expect(nextState.channels.empty_display_name).toEqual({
                id: 'empty_display_name',
                team_id: 'team',
                display_name: 'new for empty_display_name',
                type: General.DM_CHANNEL,
            });
            expect(nextState.channels.existing_display_name).toEqual({
                id: 'existing_display_name',
                team_id: 'team',
                display_name: 'existing',
                type: General.DM_CHANNEL,
            });
            expect(nextState.channels.new_display_name).toEqual({
                id: 'new_display_name',
                team_id: 'team',
                display_name: 'new for new_display_name',
                type: General.DM_CHANNEL,
            });
            expect(nextState.channels.not_a_dm).toEqual({
                id: 'not_a_dm',
                team_id: 'team',
                display_name: 'new for not_a_dm',
                type: General.GM_CHANNEL,
            });
        });

        test('should not store message count sent by server', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNELS,
                data: [
                    {
                        id: 'channel1',
                        total_msg_count: 123,
                        total_msg_count_root: 456,
                    },
                    {
                        id: 'channel2',
                        total_msg_count: 123,
                        total_msg_count_root: 456,
                    },
                ],
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels).toEqual({
                channel1: {
                    id: 'channel1',
                },
                channel2: {
                    id: 'channel2',
                },
            });
        });
    });

    describe('RECEIVED_CHANNEL_MODERATIONS', () => {
        test('Should add new channel moderations', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL_MODERATIONS,
                sync: true,
                currentChannelId: 'channel1',
                teamId: 'team',
                data: {
                    channelId: 'channel1',
                    moderations: [
                        {
                            name: Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST,
                            roles: {
                                members: true,
                            },
                        },
                    ],
                },
            });

            expect(nextState.channelModerations.channel1[0].name).toEqual(Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST);
            expect(nextState.channelModerations.channel1[0].roles.members).toEqual(true);
        });
        test('Should replace existing channel moderations', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team',
                    },
                },
                channelModerations: {
                    channel1: [{
                        name: Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_POST,
                        roles: {
                            members: true,
                        },
                    }],
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL_MODERATIONS,
                sync: true,
                currentChannelId: 'channel1',
                teamId: 'team',
                data: {
                    channelId: 'channel1',
                    moderations: [
                        {
                            name: Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_REACTIONS,
                            roles: {
                                members: true,
                                guests: false,
                            },
                        },
                    ],
                },
            });

            expect(nextState.channelModerations.channel1[0].name).toEqual(Permissions.CHANNEL_MODERATED_PERMISSIONS.CREATE_REACTIONS);
            expect(nextState.channelModerations.channel1[0].roles.members).toEqual(true);
            expect(nextState.channelModerations.channel1[0].roles.guests).toEqual(false);
        });
    });

    describe('RECEIVED_CHANNEL_MEMBER_COUNTS_BY_GROUP', () => {
        test('Should add new channel member counts', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL_MEMBER_COUNTS_BY_GROUP,
                sync: true,
                currentChannelId: 'channel1',
                teamId: 'team',
                data: {
                    channelId: 'channel1',
                    memberCounts: [
                        {
                            group_id: 'group-1',
                            channel_member_count: 1,
                            channel_member_timezones_count: 1,
                        },
                        {
                            group_id: 'group-2',
                            channel_member_count: 999,
                            channel_member_timezones_count: 131,
                        },
                    ],
                },
            });

            expect(nextState.channelMemberCountsByGroup.channel1['group-1'].channel_member_count).toEqual(1);
            expect(nextState.channelMemberCountsByGroup.channel1['group-1'].channel_member_timezones_count).toEqual(1);

            expect(nextState.channelMemberCountsByGroup.channel1['group-2'].channel_member_count).toEqual(999);
            expect(nextState.channelMemberCountsByGroup.channel1['group-2'].channel_member_timezones_count).toEqual(131);
        });
        test('Should replace existing channel member counts', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team',
                    },
                },
                channelMemberCountsByGroup: {
                    'group-1': {
                        group_id: 'group-1',
                        channel_member_count: 1,
                        channel_member_timezones_count: 1,
                    },
                    'group-2': {
                        group_id: 'group-2',
                        channel_member_count: 999,
                        channel_member_timezones_count: 131,
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: ChannelTypes.RECEIVED_CHANNEL_MEMBER_COUNTS_BY_GROUP,
                sync: true,
                currentChannelId: 'channel1',
                teamId: 'team',
                data: {
                    channelId: 'channel1',
                    memberCounts: [
                        {
                            group_id: 'group-1',
                            channel_member_count: 5,
                            channel_member_timezones_count: 2,
                        },
                        {
                            group_id: 'group-2',
                            channel_member_count: 1002,
                            channel_member_timezones_count: 133,
                        },
                        {
                            group_id: 'group-3',
                            channel_member_count: 12,
                            channel_member_timezones_count: 13,
                        },
                    ],
                },
            });

            expect(nextState.channelMemberCountsByGroup.channel1['group-1'].channel_member_count).toEqual(5);
            expect(nextState.channelMemberCountsByGroup.channel1['group-1'].channel_member_timezones_count).toEqual(2);

            expect(nextState.channelMemberCountsByGroup.channel1['group-2'].channel_member_count).toEqual(1002);
            expect(nextState.channelMemberCountsByGroup.channel1['group-2'].channel_member_timezones_count).toEqual(133);

            expect(nextState.channelMemberCountsByGroup.channel1['group-3'].channel_member_count).toEqual(12);
            expect(nextState.channelMemberCountsByGroup.channel1['group-3'].channel_member_timezones_count).toEqual(13);
        });
    });

    describe('Data Retention Channels', () => {
        test('RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team',
                    },
                    channel2: {
                        id: 'channel2',
                        team_id: 'team',
                    },
                    channel3: {
                        id: 'channel3',
                        team_id: 'team',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS,
                data: {
                    channels: [{
                        id: 'channel4',
                        team_id: 'team',
                    }],
                    total_count: 1,
                },
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                team_id: 'team',
            });
            expect(nextState.channels.channel2).toEqual({
                id: 'channel2',
                team_id: 'team',
            });
            expect(nextState.channels.channel3).toEqual({
                id: 'channel3',
                team_id: 'team',
            });
            expect(nextState.channels.channel4).toEqual({
                id: 'channel4',
                team_id: 'team',
            });
        });

        test('REMOVE_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SUCCESS', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team',
                        policy_id: 'policy1',
                    },
                    channel2: {
                        id: 'channel2',
                        team_id: 'team',
                        policy_id: 'policy1',
                    },
                    channel3: {
                        id: 'channel3',
                        team_id: 'team',
                        policy_id: 'policy1',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: AdminTypes.REMOVE_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SUCCESS,
                data: {
                    channels: ['channel1', 'channel2'],
                },
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                team_id: 'team',
                policy_id: null,
            });
            expect(nextState.channels.channel2).toEqual({
                id: 'channel2',
                team_id: 'team',
                policy_id: null,
            });
            expect(nextState.channels.channel3).toEqual({
                id: 'channel3',
                team_id: 'team',
                policy_id: 'policy1',
            });
        });
        test('RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SEARCH', () => {
            const state = deepFreeze(channelsReducer({
                channels: {
                    channel1: {
                        id: 'channel1',
                        team_id: 'team',
                    },
                    channel2: {
                        id: 'channel2',
                        team_id: 'team',
                    },
                    channel3: {
                        id: 'channel3',
                        team_id: 'team',
                    },
                },
            }, {}));

            const nextState = channelsReducer(state, {
                type: AdminTypes.RECEIVED_DATA_RETENTION_CUSTOM_POLICY_CHANNELS_SEARCH,
                data: [
                    {
                        id: 'channel1',
                        team_id: 'team',
                    },
                    {
                        id: 'channel4',
                        team_id: 'team',
                    },
                ],
            });

            expect(nextState).not.toBe(state);
            expect(nextState.channels.channel1).toEqual({
                id: 'channel1',
                team_id: 'team',
            });
            expect(nextState.channels.channel2).toEqual({
                id: 'channel2',
                team_id: 'team',
            });
            expect(nextState.channels.channel3).toEqual({
                id: 'channel3',
                team_id: 'team',
            });
            expect(nextState.channels.channel4).toEqual({
                id: 'channel4',
                team_id: 'team',
            });
        });
    });
});

describe('myMembers', () => {
    const userId = 'userId';
    const channelId = 'channelId';

    describe('RECEIVED_MY_CHANNEL_MEMBER', () => {
        test('should save a newly received channel member', () => {
            const state = deepFreeze({});

            const channelMember = TestHelper.fakeChannelMember(userId, channelId);

            const nextState = Reducers.myMembers(state, {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: channelMember,
            });

            expect(nextState).toEqual({
                [channelId]: channelMember,
            });
        });

        test('should update an existing channel member', () => {
            const state = deepFreeze({
                [channelId]: {
                    ...TestHelper.fakeChannelMember(userId, channelId),
                    msg_count: 10,
                },
            });

            const channelMember = {
                ...TestHelper.fakeChannelMember(userId, channelId),
                msg_count: 15,
            };

            const nextState = Reducers.myMembers(state, {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: channelMember,
            });

            expect(nextState).toEqual({
                [channelId]: channelMember,
            });
        });

        test('should not overwrite a more up to date last_viewed_at', () => {
            const state = deepFreeze({
                [channelId]: {
                    ...TestHelper.fakeChannelMember(userId, channelId),
                    last_viewed_at: 20000,
                    last_update_at: 10000,
                    msg_count: 10,
                },
            });

            const channelMember = {
                ...TestHelper.fakeChannelMember(userId, channelId),
                last_viewed_at: 10000,
                last_update_at: 10000,
                msg_count: 15,
            };

            const nextState = Reducers.myMembers(state, {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBER,
                data: channelMember,
            });

            expect(nextState).toEqual({
                [channelId]: {
                    ...channelMember,
                    last_viewed_at: 20000,
                    msg_count: 15,
                },
            });
        });
    });

    describe('RECEIVED_MY_CHANNEL_MEMBERS', () => {
        test('should save a newly received channel member', () => {
            const state = deepFreeze({});

            const channelMember = TestHelper.fakeChannelMember(userId, channelId);

            const nextState = Reducers.myMembers(state, {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS,
                data: [channelMember],
            });

            expect(nextState).toEqual({
                [channelId]: channelMember,
            });
        });

        test('should update an existing channel member', () => {
            const state = deepFreeze({
                [channelId]: {
                    ...TestHelper.fakeChannelMember(userId, channelId),
                    msg_count: 10,
                },
            });

            const channelMember = {
                ...TestHelper.fakeChannelMember(userId, channelId),
                msg_count: 15,
            };

            const nextState = Reducers.myMembers(state, {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS,
                data: [channelMember],
            });

            expect(nextState).toEqual({
                [channelId]: channelMember,
            });
        });

        test('should not overwrite a more up to date last_viewed_at', () => {
            const state = deepFreeze({
                [channelId]: {
                    ...TestHelper.fakeChannelMember(userId, channelId),
                    last_viewed_at: 20000,
                    last_update_at: 10000,
                    msg_count: 10,
                },
            });

            const channelMember = {
                ...TestHelper.fakeChannelMember(userId, channelId),
                last_viewed_at: 10000,
                last_update_at: 10000,
                msg_count: 15,
            };

            const nextState = Reducers.myMembers(state, {
                type: ChannelTypes.RECEIVED_MY_CHANNEL_MEMBERS,
                data: [channelMember],
            });

            expect(nextState).toEqual({
                [channelId]: {
                    ...channelMember,
                    last_viewed_at: 20000,
                    msg_count: 15,
                },
            });
        });
    });

    describe('POST_UNREAD_SUCCESS', () => {
        test('should update the channel member', () => {
            const originalChannelMember = {
                ...TestHelper.fakeChannelMember(userId, channelId),
                last_viewed_at: 10000,
                msg_count: 10,
                mention_count: 3,
                msg_count_root: 6,
                mention_count_root: 2,
            };
            const state = deepFreeze({
                [channelId]: originalChannelMember,
            });

            const nextState = Reducers.myMembers(state, {
                type: ChannelTypes.POST_UNREAD_SUCCESS,
                data: {
                    channelId,
                    lastViewedAt: 5000,
                    msgCount: 5,
                    mentionCount: 2,
                    msgCountRoot: 4,
                    mentionCountRoot: 1,
                    urgentMentionCount: 0,
                },
            });

            expect(nextState).toEqual({
                [channelId]: {
                    ...originalChannelMember,
                    last_viewed_at: 5000,
                    msg_count: 5,
                    mention_count: 2,
                    msg_count_root: 4,
                    mention_count_root: 1,
                },
            });
        });

        test('shouldn\'t make any changes if the channel member hasn\t been loaded yet', () => {
            const state = deepFreeze({});

            const nextState = Reducers.myMembers(state, {
                type: ChannelTypes.POST_UNREAD_SUCCESS,
                data: {
                    channelId,
                    lastViewedAt: 5000,
                    msgCount: 5,
                    mentionCount: 2,
                    msgCountRoot: 4,
                    mentionCountRoot: 1,
                },
            });

            expect(nextState).toBe(state);
        });
    });
});
