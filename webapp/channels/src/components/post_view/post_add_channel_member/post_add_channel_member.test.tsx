// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {sendAddToChannelEphemeralPost} from 'actions/global_actions';

import PostAddChannelMember from 'components/post_view/post_add_channel_member/post_add_channel_member';
import type {Props} from 'components/post_view/post_add_channel_member/post_add_channel_member';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('actions/global_actions', () => {
    return {
        sendAddToChannelEphemeralPost: jest.fn(),
    };
});

jest.mock('components/at_mention', () => ({mentionName}: {mentionName: string}) => (
    <span>{`@${mentionName}`}</span>
));

describe('components/post_view/PostAddChannelMember', () => {
    let generateMentionsSpy: jest.SpyInstance;
    const post: Post = TestHelper.getPostMock({
        id: 'post_id_1',
        root_id: 'root_id',
        channel_id: 'channel_id',
        create_at: 1,
    });
    const currentUser: UserProfile = TestHelper.getUserMock({
        id: 'current_user_id',
        username: 'current_username',
    });
    const requiredProps: Props = {
        currentUser,
        channelType: 'O',
        postId: 'post_id_1',
        post,
        userIds: ['user_id_1'],
        usernames: ['username_1'],
        actions: {
            removePost: jest.fn(),
            addChannelMember: jest.fn(),
        },
        noGroupsUsernames: [],
        isPolicyEnforced: false,
    };

    beforeEach(() => {
        generateMentionsSpy = jest.spyOn(PostAddChannelMember.prototype, 'generateAtMentions').mockImplementation((usernames = []) => {
            if (usernames.length > 3) {
                const otherUsersCount = usernames.length - 2;
                return (
                    <span>
                        <span>{`@${usernames[0]}`}</span>
                        <a className='PostBody_otherUsersLink'>{`${otherUsersCount} others`}</a>
                        <span>{`@${usernames[usernames.length - 1]}`}</span>
                    </span>
                );
            }

            return (
                <span>
                    {usernames.map((username) => (
                        <span key={username}>{`@${username}`}</span>
                    ))}
                </span>
            );
        });
    });

    afterEach(() => {
        generateMentionsSpy.mockRestore();
    });

    test('should match snapshot, empty postId', () => {
        const props: Props = {
            ...requiredProps,
            postId: '',
        };
        const {container} = renderWithContext(<PostAddChannelMember {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, empty channelType', () => {
        const props: Props = {
            ...requiredProps,
            channelType: '',
        };
        const {container} = renderWithContext(<PostAddChannelMember {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, public channel', () => {
        const {container} = renderWithContext(<PostAddChannelMember {...requiredProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, private channel', () => {
        const props: Props = {
            ...requiredProps,
            channelType: 'P',
        };

        const {container} = renderWithContext(<PostAddChannelMember {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, more than 3 users', async () => {
        const userIds = ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'];
        const usernames = ['username_1', 'username_2', 'username_3', 'username_4'];
        const props: Props = {
            ...requiredProps,
            userIds,
            usernames,
        };

        const {container} = renderWithContext(<PostAddChannelMember {...props}/>);
        expect(container).toMatchSnapshot();

        const user = userEvent.setup();
        const otherUsersLink = screen.getByText(/others/i).closest('a');
        if (!otherUsersLink) {
            throw new Error('Other users link not found');
        }
        await user.click(otherUsersLink);
        expect(container).toMatchSnapshot();
    });

    test('actions should have been called', async () => {
        const actions = {
            removePost: jest.fn(),
            addChannelMember: jest.fn(),
        };
        const props: Props = {...requiredProps, actions};
        renderWithContext(
            <PostAddChannelMember {...props}/>,
        );

        const user = userEvent.setup();
        const addToChannelLink = screen.getByText(/add them to the channel/i).closest('a');
        if (!addToChannelLink) {
            throw new Error('Add to channel link not found');
        }
        await user.click(addToChannelLink);

        expect(actions.addChannelMember).toHaveBeenCalledTimes(1);
        expect(actions.addChannelMember).toHaveBeenCalledWith(post.channel_id, requiredProps.userIds[0], post.root_id);
        expect(sendAddToChannelEphemeralPost).toHaveBeenCalledTimes(1);
        expect(sendAddToChannelEphemeralPost).toHaveBeenCalledWith(props.currentUser, props.usernames[0], props.userIds[0], post.channel_id, post.root_id, 2);
        expect(actions.removePost).toHaveBeenCalledTimes(1);
        expect(actions.removePost).toHaveBeenCalledWith(post);
    });

    test('addChannelMember should have been called multiple times', async () => {
        const userIds = ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'];
        const usernames = ['username_1', 'username_2', 'username_3', 'username_4'];
        const actions = {
            removePost: jest.fn(),
            addChannelMember: jest.fn(),
        };
        const props: Props = {...requiredProps, userIds, usernames, actions};
        renderWithContext(
            <PostAddChannelMember {...props}/>,
        );

        const user = userEvent.setup();
        const addToChannelLink = screen.getByText(/add them to the channel/i).closest('a');
        if (!addToChannelLink) {
            throw new Error('Add to channel link not found');
        }
        await user.click(addToChannelLink);
        expect(actions.addChannelMember).toHaveBeenCalledTimes(4);
    });

    test('should match snapshot, with no-groups usernames', () => {
        const props: Props = {
            ...requiredProps,
            noGroupsUsernames: ['user_id_2'],
        };
        const {container} = renderWithContext(<PostAddChannelMember {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with ABAC policy enforced', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['username_1', 'username_2', 'username_3'],
            isPolicyEnforced: true,
        };
        const {container} = renderWithContext(<PostAddChannelMember {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should never show invite links when policy is enforced (ABAC channels)', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['username_1', 'username_2'],
            noGroupsUsernames: [],
            isPolicyEnforced: true,
        };
        renderWithContext(<PostAddChannelMember {...props}/>);
        expect(screen.queryByRole('link', {name: /add them/i})).not.toBeInTheDocument();
    });

    test('should show single consolidated message for ABAC channels regardless of user types', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['user1', 'user2'],
            noGroupsUsernames: ['user3'],
            isPolicyEnforced: true,
        };
        renderWithContext(<PostAddChannelMember {...props}/>);

        expect(screen.getByText('did not get notified by this mention because they are not in the channel.')).toBeInTheDocument();
        expect(screen.queryByRole('link', {name: /add them/i})).not.toBeInTheDocument();
    });
});
