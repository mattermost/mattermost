// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';

import {Posts} from 'mattermost-redux/constants';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {boardChannelsState} from 'utils/channel_kind_test_utils';
import {TestHelper} from 'utils/test_helper';

import type {AddMemberProps} from './system_message_helpers';
import {isAddMemberProps, renderSystemMessage} from './system_message_helpers';

import PostMarkdown from './index';

describe('isAddMemberProps', () => {
    it('with empty lists', () => {
        const prop: AddMemberProps = {
            post_id: '',
            not_in_channel_user_ids: [],
            not_in_channel_usernames: [],
            not_in_groups_usernames: [],
        };

        expect(isAddMemberProps(prop)).toBe(true);
    });

    it('with values in lists', () => {
        const prop: AddMemberProps = {
            post_id: '',
            not_in_channel_user_ids: ['hello', 'world'],
            not_in_channel_usernames: ['hello', 'world'],
            not_in_groups_usernames: ['hello', 'world'],
        };

        expect(isAddMemberProps(prop)).toBe(true);
    });

    it('all values are required', () => {
        const baseProp: AddMemberProps = {
            post_id: '',
            not_in_channel_user_ids: [],
            not_in_channel_usernames: [],
            not_in_groups_usernames: [],
        };

        expect(isAddMemberProps(baseProp)).toBe(true);

        for (const key of Object.keys(baseProp)) {
            const wrongProp: Partial<AddMemberProps> = {...baseProp};
            delete wrongProp[key as keyof AddMemberProps];
            expect(isAddMemberProps(wrongProp)).toBe(false);
        }
    });

    it('common false cases', () => {
        expect(isAddMemberProps('')).toBe(false);
        expect(isAddMemberProps(undefined)).toBe(false);
        expect(isAddMemberProps(true)).toBe(false);
        expect(isAddMemberProps(1)).toBe(false);
        expect(isAddMemberProps([])).toBe(false);
    });
});

describe('renderSystemMessage shared channel state (renderSharedChannelStateMessage)', () => {
    const minimalChannel = {
        id: 'channel_id',
        team_id: 'team_id',
        type: 'O',
    } as Channel;

    function renderSharedChannelStatePost(post: Post) {
        return renderWithContext(
            <div>{renderSystemMessage(post, 'team', minimalChannel, false)}</div>,
        );
    }

    it('renders shared state with workspace name', () => {
        const post: Partial<Post> = {
            id: 'p1',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'shared',
                workspace_name: 'Acme Corp',
            },
        };

        renderSharedChannelStatePost(post as Post);
        expect(screen.getByText('This channel is now shared with Acme Corp.')).toBeInTheDocument();
    });

    it('renders unshared with known workspace', () => {
        const post: Partial<Post> = {
            id: 'p2',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'unshared',
                workspace_name: 'Acme Corp',
            },
        };

        renderSharedChannelStatePost(post as Post);
        expect(screen.getByText('This channel is no longer shared with Acme Corp.')).toBeInTheDocument();
    });

    it('renders unshared with unknown workspace', () => {
        const post: Partial<Post> = {
            id: 'p3',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'unshared',
            },
        };

        renderSharedChannelStatePost(post as Post);
        expect(screen.getByText('This channel is no longer shared with another workspace.')).toBeInTheDocument();
    });

    it('returns null for invalid state string', () => {
        const post: Partial<Post> = {
            id: 'p4',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: 'not-a-valid-state',
            },
        };

        const {container} = renderSharedChannelStatePost(post as Post);
        expect(container.firstChild).toBeEmptyDOMElement();
    });

    it('returns null when shared_channel_state is null', () => {
        const post: Partial<Post> = {
            id: 'p5',
            type: Posts.POST_TYPES.SHARED_CHANNEL_STATE,
            message: '',
            props: {
                shared_channel_state: null,
            },
        };

        const {container} = renderSharedChannelStatePost(post as Post);
        expect(container.firstChild).toBeEmptyDOMElement();
    });
});

describe('renderSystemMessage team access control posts', () => {
    const minimalChannel = {
        id: 'channel_id',
        team_id: 'team_id',
        type: 'D',
    } as Channel;

    function renderTeamAccessControlPost(post: Post) {
        return renderWithContext(
            <div>{renderSystemMessage(post, 'team', minimalChannel, false)}</div>,
        );
    }

    it('renders the team membership removal message with the team name', () => {
        const post: Partial<Post> = {
            id: 'p1',
            type: Posts.POST_TYPES.ACCESS_CONTROL_TEAM_REMOVAL,
            message: 'server fallback text',
            props: {team_name: 'Engineering'},
        };

        renderTeamAccessControlPost(post as Post);
        expect(screen.getByText('You have been removed from Engineering because you no longer meet the membership requirements.')).toBeInTheDocument();
    });

    it('renders the team membership addition message with the team name', () => {
        const post: Partial<Post> = {
            id: 'p2',
            type: Posts.POST_TYPES.ACCESS_CONTROL_TEAM_ADDITION,
            message: 'server fallback text',
            props: {team_name: 'Engineering'},
        };

        renderTeamAccessControlPost(post as Post);
        expect(screen.getByText('You have been added to Engineering because you now meet the membership requirements.')).toBeInTheDocument();
    });

    it('returns null for an unrelated system post type so the raw message is used as fallback', () => {
        const post: Partial<Post> = {
            id: 'p3',
            type: 'system_some_unhandled_type' as Post['type'],
            message: 'raw message',
            props: {},
        };

        const {container} = renderTeamAccessControlPost(post as Post);
        expect(container.firstChild).toBeEmptyDOMElement();
    });
});

describe('renderSystemMessage in a board', () => {
    const boardId = 'board_id';
    const channelId = 'channel_id';

    const currentUser = TestHelper.getUserMock({id: 'current_user_id', username: 'current_username'});
    const users = [
        currentUser,
        TestHelper.getUserMock({id: 'user_id_1', username: 'user1'}),
        TestHelper.getUserMock({id: 'user_id_2', username: 'user2'}),
        TestHelper.getUserMock({id: 'user_id_3', username: 'user3'}),
        TestHelper.getUserMock({id: 'actor_id', username: 'actor'}),
    ];

    const baseState = {
        entities: {
            channels: {
                channels: {
                    [boardId]: TestHelper.getChannelMock({id: boardId, type: 'O'}),
                    [channelId]: TestHelper.getChannelMock({id: channelId, type: 'O'}),
                },
            },
            users: {
                currentUserId: currentUser.id,
                profiles: Object.fromEntries(users.map((user) => [user.id, user])),
            },
            general: {config: {EnableJoinLeaveMessageByDefault: 'true'}},
        },
    };

    function renderPost(type: string, props: Post['props'], inBoard: boolean) {
        const post = TestHelper.getPostMock({
            id: 'post_id',
            channel_id: inBoard ? boardId : channelId,
            type: type as Post['type'],
            message: '',
            props,
        });

        return renderWithContext(
            <PostMarkdown
                message={post.message}
                post={post}
                channelId={post.channel_id}
            />,
            {...baseState, ...boardChannelsState(boardId)},
        );
    }

    const cases: Array<[string, string, Post['props'], string, string]> = [
        ['join', Posts.POST_TYPES.JOIN_CHANNEL, {username: 'user1'}, 'joined the board.', 'joined the channel.'],
        ['guest join', Posts.POST_TYPES.GUEST_JOIN_CHANNEL, {username: 'user1'}, 'joined the board as a guest.', 'joined the channel as a guest.'],
        ['leave', Posts.POST_TYPES.LEAVE_CHANNEL, {username: 'user1'}, 'left the board.', 'left the channel.'],
        ['add', Posts.POST_TYPES.ADD_TO_CHANNEL, {username: 'actor', addedUsername: 'user1'}, 'added to the board by', 'added to the channel by'],
        ['add guest', Posts.POST_TYPES.ADD_GUEST_TO_CHANNEL, {username: 'actor', addedUsername: 'user1'}, 'added to the board as a guest by', 'added to the channel as a guest by'],
        ['remove', Posts.POST_TYPES.REMOVE_FROM_CHANNEL, {removedUsername: 'user1'}, 'was removed from the board', 'was removed from the channel'],
        ['header updated from', Posts.POST_TYPES.HEADER_CHANGE, {username: 'user1', old_header: 'old', new_header: 'new'}, 'updated the board header', 'updated the channel header'],
        ['header updated to', Posts.POST_TYPES.HEADER_CHANGE, {username: 'user1', new_header: 'new'}, 'updated the board header to:', 'updated the channel header to:'],
        ['header removed', Posts.POST_TYPES.HEADER_CHANGE, {username: 'user1', old_header: 'old'}, 'removed the board header (was:', 'removed the channel header (was:'],
        ['display name', Posts.POST_TYPES.DISPLAYNAME_CHANGE, {username: 'user1', old_displayname: 'Old', new_displayname: 'New'}, 'updated the board display name from: Old to: New', 'updated the channel display name from: Old to: New'],
        ['convert to private', Posts.POST_TYPES.CONVERT_CHANNEL, {username: 'user1'}, 'converted the board from public to private', 'converted the channel from public to private'],
        ['purpose updated from', Posts.POST_TYPES.PURPOSE_CHANGE, {username: 'user1', old_purpose: 'old', new_purpose: 'new'}, 'updated the board purpose from: old to: new', 'updated the channel purpose from: old to: new'],
        ['purpose updated to', Posts.POST_TYPES.PURPOSE_CHANGE, {username: 'user1', new_purpose: 'new'}, 'updated the board purpose to: new', 'updated the channel purpose to: new'],
        ['purpose removed', Posts.POST_TYPES.PURPOSE_CHANGE, {username: 'user1', old_purpose: 'old'}, 'removed the board purpose (was: old)', 'removed the channel purpose (was: old)'],
        ['archived', Posts.POST_TYPES.CHANNEL_DELETED, {username: 'user1'}, 'archived the board.', 'archived the channel.'],
        ['unarchived', Posts.POST_TYPES.CHANNEL_UNARCHIVED, {username: 'user1'}, 'unarchived the board.', 'unarchived the channel.'],
        ['auto-translation enabled', Posts.POST_TYPES.AUTO_TRANSLATION_CHANGE, {username: 'user1', enabled: true}, 'enabled Auto-translation for this board.', 'enabled Auto-translation for this channel.'],
        ['auto-translation disabled', Posts.POST_TYPES.AUTO_TRANSLATION_CHANGE, {username: 'user1', enabled: false}, 'disabled Auto-translation for this board.', 'disabled Auto-translation for this channel.'],
        ['now shared', Posts.POST_TYPES.SHARED_CHANNEL_STATE, {shared_channel_state: 'shared', workspace_name: 'Remote'}, 'This board is now shared with Remote.', 'This channel is now shared with Remote.'],
        ['no longer shared', Posts.POST_TYPES.SHARED_CHANNEL_STATE, {shared_channel_state: 'unshared', workspace_name: 'Remote'}, 'This board is no longer shared with Remote.', 'This channel is no longer shared with Remote.'],
        ['no longer shared, unknown workspace', Posts.POST_TYPES.SHARED_CHANNEL_STATE, {shared_channel_state: 'unshared'}, 'This board is no longer shared with another workspace.', 'This channel is no longer shared with another workspace.'],
    ];

    it.each(cases)('says board in the %s message for a board', (_name, type, props, boardText, channelText) => {
        const {container} = renderPost(type, props, true);

        expect(container).toHaveTextContent(boardText);
        expect(container).not.toHaveTextContent(channelText);
    });

    it.each(cases)('keeps channel in the %s message for a channel', (_name, type, props, boardText, channelText) => {
        const {container} = renderPost(type, props, false);

        expect(container).toHaveTextContent(channelText);
        expect(container).not.toHaveTextContent(boardText);
    });

    function combinedProps(postType: string, userIds: string[], actorId = 'actor_id') {
        return {
            user_activity: {
                allUserIds: [...userIds, actorId],
                allUsernames: [],
                messageData: [{postType, userIds, actorId}],
            },
        };
    }

    const combinedCases: Array<[string, Post['props'], string, string]> = [
        ['one user joined', combinedProps(Posts.POST_TYPES.JOIN_CHANNEL, ['user_id_1']), '@user1 joined the board.', 'joined the channel'],
        ['you joined', combinedProps(Posts.POST_TYPES.JOIN_CHANNEL, ['current_user_id']), 'You joined the board.', 'joined the channel'],
        ['two users left', combinedProps(Posts.POST_TYPES.LEAVE_CHANNEL, ['user_id_1', 'user_id_2']), '@user1 and @user2 left the board.', 'left the channel'],
        ['one user added', combinedProps(Posts.POST_TYPES.ADD_TO_CHANNEL, ['user_id_1']), '@user1 added to the board by @actor.', 'added to the channel'],
        ['you were added', combinedProps(Posts.POST_TYPES.ADD_TO_CHANNEL, ['current_user_id']), 'You were added to the board by @actor.', 'added to the channel'],
        ['one user removed', combinedProps(Posts.POST_TYPES.REMOVE_FROM_CHANNEL, ['user_id_1']), '@user1 was removed from the board.', 'removed from the channel'],
        ['you were removed', combinedProps(Posts.POST_TYPES.REMOVE_FROM_CHANNEL, ['current_user_id']), 'You were removed from the board.', 'removed from the channel'],
        ['one user joined and left', combinedProps(Posts.POST_TYPES.JOIN_LEAVE_CHANNEL, ['user_id_1']), '@user1 joined and left the board.', 'left the channel'],
        ['many users added', combinedProps(Posts.POST_TYPES.ADD_TO_CHANNEL, ['user_id_1', 'user_id_2', 'user_id_3']), 'were added to the board by @actor.', 'added to the channel'],
        ['many users joined', combinedProps(Posts.POST_TYPES.JOIN_CHANNEL, ['user_id_1', 'user_id_2', 'user_id_3']), 'joined the board.', 'joined the channel'],
        ['many users removed', combinedProps(Posts.POST_TYPES.REMOVE_FROM_CHANNEL, ['user_id_1', 'user_id_2', 'user_id_3']), 'were removed from the board.', 'removed from the channel'],
    ];

    it.each(combinedCases)('says board in the combined message when %s in a board', (_name, props, boardText, channelText) => {
        const {container} = renderPost(Posts.POST_TYPES.COMBINED_USER_ACTIVITY, props, true);

        expect(container).toHaveTextContent(boardText);
        expect(container).not.toHaveTextContent(channelText);
    });

    it('keeps channel in the combined message in a channel', () => {
        const {container} = renderPost(Posts.POST_TYPES.COMBINED_USER_ACTIVITY, combinedProps(Posts.POST_TYPES.JOIN_CHANNEL, ['user_id_1']), false);

        expect(container).toHaveTextContent('@user1 joined the channel.');
        expect(container).not.toHaveTextContent('joined the board');
    });

    it('says board in the expanded combined message for many users in a board', async () => {
        const {container} = renderPost(Posts.POST_TYPES.COMBINED_USER_ACTIVITY, combinedProps(Posts.POST_TYPES.LEAVE_CHANNEL, ['user_id_1', 'user_id_2', 'user_id_3']), true);

        expect(container).toHaveTextContent('@user1 and 2 others left the board.');

        await userEvent.click(screen.getByText('2 others'));

        expect(container).toHaveTextContent('@user1, @user2 and @user3 left the board.');
        expect(container).not.toHaveTextContent('left the channel');
    });
});
