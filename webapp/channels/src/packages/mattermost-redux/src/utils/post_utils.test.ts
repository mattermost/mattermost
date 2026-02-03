// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post, PostEmbed, PostEmbedType, PostType} from '@mattermost/types/posts';
import type {GlobalState} from '@mattermost/types/store';

import {PostTypes} from 'mattermost-redux/constants/posts';
import {
    canEditPost,
    isSystemMessage,
    shouldIgnorePost,
    isMeMessage,
    isUserActivityPost,
    shouldFilterJoinLeavePost,
    isPostCommentMention,
    getEmbedFromMetadata,
    shouldUpdatePost,
    isPermalink,
} from 'mattermost-redux/utils/post_utils';

import TestHelper from '../../test/test_helper';
import {Permissions} from '../constants';

describe('PostUtils', () => {
    describe('shouldFilterJoinLeavePost', () => {
        it('show join/leave posts', () => {
            const showJoinLeave = true;

            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: ''}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.CHANNEL_DELETED}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.DISPLAYNAME_CHANGE}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.CONVERT_CHANNEL}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.EPHEMERAL}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.HEADER_CHANGE}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.PURPOSE_CHANGE}), showJoinLeave, '')).toBe(false);

            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_LEAVE}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_REMOVE}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL}), showJoinLeave, '')).toBe(false);

            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_TEAM}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM}), showJoinLeave, '')).toBe(false);
        });

        it('hide join/leave posts', () => {
            const showJoinLeave = false;

            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: ''}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.CHANNEL_DELETED}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.DISPLAYNAME_CHANGE}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.CONVERT_CHANNEL}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.EPHEMERAL}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.HEADER_CHANGE}), showJoinLeave, '')).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.PURPOSE_CHANGE}), showJoinLeave, '')).toBe(false);

            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_LEAVE}), showJoinLeave, '')).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL}), showJoinLeave, '')).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL}), showJoinLeave, '')).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_REMOVE}), showJoinLeave, '')).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL}), showJoinLeave, '')).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL}), showJoinLeave, '')).toBe(true);

            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_TEAM}), showJoinLeave, '')).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM}), showJoinLeave, '')).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM}), showJoinLeave, '')).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM}), showJoinLeave, '')).toBe(true);
        });

        it('always join/leave posts for the current user', () => {
            const username = 'user1';
            const otherUsername = 'user2';
            const showJoinLeave = false;

            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, props: {username}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL, props: {username: otherUsername}}), showJoinLeave, username)).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, props: {username}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL, props: {username: otherUsername}}), showJoinLeave, username)).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, props: {username, addedUsername: otherUsername}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, props: {username: otherUsername, addedUsername: username}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL, props: {username: otherUsername, addedUsername: otherUsername}}), showJoinLeave, username)).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL, props: {removedUsername: username}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL, props: {removedUsername: otherUsername}}), showJoinLeave, username)).toBe(true);

            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_TEAM, props: {username}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.JOIN_TEAM, props: {username: otherUsername}}), showJoinLeave, username)).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM, props: {username}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM, props: {username: otherUsername}}), showJoinLeave, username)).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM, props: {username, addedUsername: otherUsername}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM, props: {username: otherUsername, addedUsername: username}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM, props: {username: otherUsername, addedUsername: otherUsername}}), showJoinLeave, username)).toBe(true);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM, props: {removedUsername: username}}), showJoinLeave, username)).toBe(false);
            expect(shouldFilterJoinLeavePost(TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM, props: {removedUsername: otherUsername}}), showJoinLeave, username)).toBe(true);
        });
    });

    describe('canEditPost', () => {
        const licensed = {IsLicensed: 'true'};
        const teamId = 'team-id';
        const channelId = 'channel-id';
        const userId = 'user-id';

        it('should work with new permissions version', () => {
            let newVersionState = {
                entities: {
                    general: {
                        serverVersion: '4.9.0',
                    },
                    users: {
                        currentUserId: userId,
                        profiles: {
                            'user-id': {roles: 'system_role'},
                        },
                    },
                    teams: {
                        currentTeamId: teamId,
                        myMembers: {
                            'team-id': {roles: 'team_role'},
                        },
                    },
                    channels: {
                        currentChannelId: channelId,
                        myMembers: {
                            'channel-id': {roles: 'channel_role'},
                        },
                        roles: {
                            'channel-id': ['channel_role'],
                        },
                    },
                    roles: {
                        roles: {
                            system_role: {
                                permissions: [],
                            },
                            team_role: {
                                permissions: [],
                            },
                            channel_role: {
                                permissions: [],
                            },
                        },
                    },
                },
            } as unknown as GlobalState;

            // With new permissions
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();

            newVersionState.entities.roles = {
                roles: {
                    system_role: TestHelper.getRoleMock({permissions: [Permissions.EDIT_POST]}),
                    team_role: TestHelper.getRoleMock({permissions: []}),
                    channel_role: TestHelper.getRoleMock({permissions: []}),
                },
                pending: new Set(),
            };
            newVersionState = {...newVersionState};
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();

            newVersionState.entities.roles = {
                roles: {
                    system_role: TestHelper.getRoleMock({permissions: []}),
                    team_role: TestHelper.getRoleMock({permissions: [Permissions.EDIT_POST]}),
                    channel_role: TestHelper.getRoleMock({permissions: []}),
                },
                pending: new Set(),
            };
            newVersionState = {...newVersionState};
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();

            newVersionState.entities.roles = {
                roles: {
                    system_role: TestHelper.getRoleMock({permissions: []}),
                    team_role: TestHelper.getRoleMock({permissions: []}),
                    channel_role: TestHelper.getRoleMock({permissions: [Permissions.EDIT_POST]}),
                },
                pending: new Set(),
            };
            newVersionState = {...newVersionState};
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();

            newVersionState.entities.roles = {
                roles: {
                    system_role: TestHelper.getRoleMock({permissions: [Permissions.EDIT_OTHERS_POSTS]}),
                    team_role: TestHelper.getRoleMock({permissions: []}),
                    channel_role: TestHelper.getRoleMock({permissions: []}),
                },
                pending: new Set(),
            };
            newVersionState = {...newVersionState};
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();

            newVersionState.entities.roles = {
                roles: {
                    system_role: TestHelper.getRoleMock({permissions: []}),
                    team_role: TestHelper.getRoleMock({permissions: [Permissions.EDIT_OTHERS_POSTS]}),
                    channel_role: TestHelper.getRoleMock({permissions: []}),
                },
                pending: new Set(),
            };
            newVersionState = {...newVersionState};
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();

            newVersionState.entities.roles = {
                roles: {
                    system_role: TestHelper.getRoleMock({permissions: []}),
                    team_role: TestHelper.getRoleMock({permissions: []}),
                    channel_role: TestHelper.getRoleMock({permissions: [Permissions.EDIT_OTHERS_POSTS]}),
                },
                pending: new Set(),
            };
            newVersionState = {...newVersionState};
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();

            newVersionState.entities.roles = {
                roles: {
                    system_role: TestHelper.getRoleMock({permissions: [Permissions.EDIT_OTHERS_POSTS, Permissions.EDIT_POST]}),
                    team_role: TestHelper.getRoleMock({permissions: []}),
                    channel_role: TestHelper.getRoleMock({permissions: []}),
                },
                pending: new Set(),
            };
            newVersionState = {...newVersionState};
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();

            newVersionState.entities.roles = {
                roles: {
                    system_role: TestHelper.getRoleMock({permissions: []}),
                    team_role: TestHelper.getRoleMock({permissions: [Permissions.EDIT_OTHERS_POSTS, Permissions.EDIT_POST]}),
                    channel_role: TestHelper.getRoleMock({permissions: []}),
                },
                pending: new Set(),
            };
            newVersionState = {...newVersionState};
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();

            newVersionState.entities.roles = {
                roles: {
                    system_role: TestHelper.getRoleMock({permissions: []}),
                    team_role: TestHelper.getRoleMock({permissions: []}),
                    channel_role: TestHelper.getRoleMock({permissions: [Permissions.EDIT_OTHERS_POSTS, Permissions.EDIT_POST]}),
                },
                pending: new Set(),
            };
            newVersionState = {...newVersionState};
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: userId, create_at: Date.now() - 6000000}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: -1}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other'}))).toBeTruthy();
            expect(canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 100}))).toBeTruthy();
            expect(!canEditPost(newVersionState, {PostEditTimeLimit: 300}, licensed, teamId, channelId, userId, TestHelper.getPostMock({user_id: 'other', create_at: Date.now() - 6000000}))).toBeTruthy();
        });
    });

    describe('isSystemMessage', () => {
        const testCases = [
            {input: TestHelper.getPostMock({type: ''}), output: false},

            {input: TestHelper.getPostMock({type: PostTypes.CHANNEL_DELETED}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.CHANNEL_UNARCHIVED}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.DISPLAYNAME_CHANGE}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.CONVERT_CHANNEL}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.EPHEMERAL}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.EPHEMERAL_ADD_TO_CHANNEL}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.HEADER_CHANGE}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.PURPOSE_CHANGE}), output: true},

            {input: TestHelper.getPostMock({type: PostTypes.JOIN_LEAVE}), output: true}, // deprecated system type
            {input: TestHelper.getPostMock({type: PostTypes.ADD_REMOVE}), output: true}, // deprecated system type

            {input: TestHelper.getPostMock({type: PostTypes.COMBINED_USER_ACTIVITY}), output: true},

            {input: TestHelper.getPostMock({type: PostTypes.ADD_TO_CHANNEL}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.JOIN_CHANNEL}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.LEAVE_CHANNEL}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_CHANNEL}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.ADD_TO_TEAM}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.JOIN_TEAM}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.LEAVE_TEAM}), output: true},
            {input: TestHelper.getPostMock({type: PostTypes.REMOVE_FROM_TEAM}), output: true},
        ];

        testCases.forEach((testCase) => {
            it(`should identify if post is system message: isSystemMessage('${testCase.input}') should return ${testCase.output}`, () => {
                expect(isSystemMessage(testCase.input)).toBe(testCase.output);
            });
        });
    });

    describe('shouldIgnorePost', () => {
        it('should return false if system message is adding current user', () => {
            const currentUserId = 'czduet3upjfupy9xnqswrxaqea';
            const post = TestHelper.getPostMock({
                type: PostTypes.ADD_TO_CHANNEL,
                user_id: 'anotherUserId',
                props: {
                    addedUserId: 'czduet3upjfupy9xnqswrxaqea',
                },
            });
            const evalShouldIgnorePost = shouldIgnorePost(post, currentUserId);
            expect(evalShouldIgnorePost).toBe(false);
        });
        it('should return true if system message is adding a different user', () => {
            const currentUserId = 'czduet3upjfupy9xnqswrxaqea';
            const post = TestHelper.getPostMock({
                type: PostTypes.ADD_TO_CHANNEL,
                props: {
                    addedUserId: 'mrbijaq9mjr3ue569kake9m6do',
                },
            });
            const evalShouldIgnorePost = shouldIgnorePost(post, currentUserId);
            expect(evalShouldIgnorePost).toBe(true);
        });
    });

    describe('isUserActivityPost', () => {
        const testCases = [
            {input: '' as any, output: false},
            {input: null as any, output: false},

            {input: PostTypes.CHANNEL_DELETED, output: false},
            {input: PostTypes.DISPLAYNAME_CHANGE, output: false},
            {input: PostTypes.CONVERT_CHANNEL, output: false},
            {input: PostTypes.EPHEMERAL, output: false},
            {input: PostTypes.EPHEMERAL_ADD_TO_CHANNEL, output: false},
            {input: PostTypes.HEADER_CHANGE, output: false},
            {input: PostTypes.PURPOSE_CHANGE, output: false},

            {input: PostTypes.JOIN_LEAVE, output: false}, // deprecated system type
            {input: PostTypes.ADD_REMOVE, output: false}, // deprecated system type

            {input: PostTypes.COMBINED_USER_ACTIVITY, output: false},

            {input: PostTypes.ADD_TO_CHANNEL, output: true},
            {input: PostTypes.JOIN_CHANNEL, output: true},
            {input: PostTypes.LEAVE_CHANNEL, output: true},
            {input: PostTypes.REMOVE_FROM_CHANNEL, output: true},
            {input: PostTypes.ADD_TO_TEAM, output: true},
            {input: PostTypes.JOIN_TEAM, output: true},
            {input: PostTypes.LEAVE_TEAM, output: true},
            {input: PostTypes.REMOVE_FROM_TEAM, output: true},
        ];

        testCases.forEach((testCase) => {
            it(`should identify if post is user activity - add/remove/join/leave channel/team: isUserActivityPost('${testCase.input}') should return ${testCase.output}`, () => {
                expect(isUserActivityPost(testCase.input)).toBe(testCase.output);
            });
        });
    });

    describe('isPostCommentMention', () => {
        const currentUser = TestHelper.getUserMock({
            id: 'currentUser',
            notify_props: {
                ...TestHelper.getUserMock({}).notify_props,
                comments: 'any',
            },
        });
        it('should return true as root post is by user', () => {
            const post = TestHelper.getPostMock({
                user_id: 'someotherUser',
            });

            const rootPost = TestHelper.getPostMock({
                user_id: 'currentUser',
            });

            const isCommentMention = isPostCommentMention({currentUser, post, rootPost, threadRepliedToByCurrentUser: false});
            expect(isCommentMention).toBe(true);
        });

        it('should return false as root post is not by user and did not participate in thread', () => {
            const post = TestHelper.getPostMock({
                user_id: 'someotherUser',
            });

            const rootPost = TestHelper.getPostMock({
                user_id: 'differentUser',
            });

            const isCommentMention = isPostCommentMention({currentUser, post, rootPost, threadRepliedToByCurrentUser: false});
            expect(isCommentMention).toBe(false);
        });

        it('should return false post is by current User', () => {
            const post = TestHelper.getPostMock({
                user_id: 'currentUser',
            });

            const rootPost = TestHelper.getPostMock({
                user_id: 'differentUser',
            });

            const isCommentMention = isPostCommentMention({currentUser, post, rootPost, threadRepliedToByCurrentUser: false});
            expect(isCommentMention).toBe(false);
        });

        it('should return true as post is by current User but it is a webhhok and user participated in thread', () => {
            const post = TestHelper.getPostMock({
                user_id: 'currentUser',
                props: {
                    from_webhook: 'true',
                },
            });

            const rootPost = TestHelper.getPostMock({
                user_id: 'differentUser',
            });

            const isCommentMention = isPostCommentMention({currentUser, post, rootPost, threadRepliedToByCurrentUser: true});
            expect(isCommentMention).toBe(true);
        });

        it('should return false as root post is not by currentUser and notify_props is root', () => {
            const post = TestHelper.getPostMock({
                user_id: 'someotherUser',
            });

            const rootPost = TestHelper.getPostMock({
                user_id: 'differentUser',
            });

            const modifiedCurrentUser = {
                ...currentUser,
                notify_props: {
                    ...currentUser.notify_props,
                    comments: 'root' as const,
                },
            };

            const isCommentMention = isPostCommentMention({currentUser: modifiedCurrentUser, post, rootPost, threadRepliedToByCurrentUser: true});
            expect(isCommentMention).toBe(false);
        });

        it('should return true as root post is by currentUser and notify_props is root', () => {
            const post = TestHelper.getPostMock({
                user_id: 'someotherUser',
            });

            const rootPost = TestHelper.getPostMock({
                user_id: 'currentUser',
            });

            const modifiedCurrentUser = {
                ...currentUser,
                notify_props: {
                    ...currentUser.notify_props,
                    comments: 'root' as const,
                },
            };

            const isCommentMention = isPostCommentMention({currentUser: modifiedCurrentUser, post, rootPost, threadRepliedToByCurrentUser: true});
            expect(isCommentMention).toBe(true);
        });
    });

    describe('isMeMessage', () => {
        it('should correctly identify messages generated from /me', () => {
            for (const data of [
                {
                    post: TestHelper.getPostMock({type: 'hello' as PostType}),
                    result: false,
                },
                {
                    post: TestHelper.getPostMock({type: 'ME' as PostType}),
                    result: false,
                },
                {
                    post: TestHelper.getPostMock({type: PostTypes.ME}),
                    result: true,
                },
            ]) {
                const confirmation = isMeMessage(data.post);
                expect(confirmation).toBe(data.result);
            }
        });
    });

    describe('getEmbedFromMetadata', () => {
        it('should return null if no metadata is not passed as argument', () => {
            const embedData = (getEmbedFromMetadata as any)();
            expect(embedData).toBe(null);
        });

        it('should return null if argument does not contain embed key', () => {
            const embedData = (getEmbedFromMetadata as any)({});
            expect(embedData).toBe(null);
        });

        it('should return null if embed key in argument is empty', () => {
            const embedData = (getEmbedFromMetadata as any)({embeds: []});
            expect(embedData).toBe(null);
        });

        it('should return first entry in embed key', () => {
            const embedValue = {type: 'opengraph' as PostEmbedType, url: 'url'};
            const embedData = getEmbedFromMetadata({embeds: [embedValue, {type: 'image', url: 'url1'}]} as Post['metadata']);
            expect(embedData).toEqual(embedValue);
        });
    });

    describe('isPermalink', () => {
        it('should return true if post contains permalink', () => {
            const post = TestHelper.getPostMock({
                metadata: {embeds: [{type: 'permalink', url: ''}]} as Post['metadata'],
            });
            expect(isPermalink(post)).toBe(true);
        });

        it('should return false if post contains an embed that is not a permalink', () => {
            const post = TestHelper.getPostMock({
                metadata: {embeds: [{type: 'opengraph', url: ''}]} as Post['metadata'],
            });
            expect(isPermalink(post)).toBe(false);
        });

        it('should return false if post has no embeds', () => {
            const embeds: PostEmbed[] = [];
            const post = TestHelper.getPostMock({
                metadata: {embeds} as Post['metadata'],
            });
            expect(isPermalink(post)).toBe(false);
        });
    });

    describe('shouldUpdatePost', () => {
        const storedPost = TestHelper.getPostMock({
            id: 'post1',
            message: '123',
            update_at: 100,
            is_following: false,
            participants: null,
            reply_count: 4,
        });

        it('should return true for new posts', () => {
            const post = TestHelper.getPostMock({
                ...storedPost,
                update_at: 100,
            });

            expect(shouldUpdatePost(post)).toBe(true);
        });

        it('should return false for older posts', () => {
            const post = {
                ...storedPost,
                update_at: 40,
            };

            expect(shouldUpdatePost(post, storedPost)).toBe(false);
        });

        it('should return true for newer posts', () => {
            const post = TestHelper.getPostMock({
                id: 'post1',
                message: 'test',
                update_at: 400,
                is_following: false,
                participants: null,
                reply_count: 4,
            });
            expect(shouldUpdatePost(post, storedPost)).toBe(true);
        });

        it('should return false for same posts', () => {
            const post = {...storedPost};
            expect(shouldUpdatePost(post, storedPost)).toBe(false);
        });

        it('should return true for same posts with participants changed', () => {
            const post = {
                ...storedPost,
                participants: [],
            };
            expect(shouldUpdatePost(post, storedPost)).toBe(true);
        });

        it('should return true for same posts with reply_count changed', () => {
            const post = {
                ...storedPost,
                reply_count: 2,
            };
            expect(shouldUpdatePost(post, storedPost)).toBe(true);
        });

        it('should return true for same posts with is_following changed', () => {
            const post = {
                ...storedPost,
                is_following: true,
            };
            expect(shouldUpdatePost(post, storedPost)).toBe(true);
        });

        it('should return true for same posts with metadata in received post and not in stored post', () => {
            const post = TestHelper.getPostMock({
                ...storedPost,
                metadata: {embeds: [{type: 'permalink'}]} as Post['metadata'],
            });
            const storedPostSansMetadata = {...storedPost};
            delete (storedPostSansMetadata as any).metadata;
            expect(shouldUpdatePost(post, storedPostSansMetadata)).toBe(true);
        });
    });
});
