// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import * as globalActions from 'actions/global_actions';

import PostAddChannelMember from 'components/post_view/post_add_channel_member/post_add_channel_member';
import type {Props} from 'components/post_view/post_add_channel_member/post_add_channel_member';

import {renderWithContext, screen, userEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

vi.mock('actions/global_actions', () => {
    return {
        sendAddToChannelEphemeralPost: vi.fn(),
    };
});

describe('components/post_view/PostAddChannelMember', () => {
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
            removePost: vi.fn(),
            addChannelMember: vi.fn(),
        },
        noGroupsUsernames: [],
        isPolicyEnforced: false,
    };

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

        // Find and click the "others" link to expand
        // With 4 users, it shows: first user, "2 others", and last user
        const othersLink = screen.getByText(/2 others/);
        await userEvent.click(othersLink);

        expect(container).toMatchSnapshot();
    });

    test('actions should have been called', async () => {
        const actions = {
            removePost: vi.fn(),
            addChannelMember: vi.fn(),
        };
        const props: Props = {...requiredProps, actions};
        renderWithContext(
            <PostAddChannelMember {...props}/>,
        );

        const addLink = screen.getByText('add them to the channel');
        await userEvent.click(addLink);

        expect(actions.addChannelMember).toHaveBeenCalledTimes(1);
        expect(actions.addChannelMember).toHaveBeenCalledWith(post.channel_id, requiredProps.userIds[0], post.root_id);
        expect(globalActions.sendAddToChannelEphemeralPost).toHaveBeenCalledTimes(1);
        expect(globalActions.sendAddToChannelEphemeralPost).toHaveBeenCalledWith(props.currentUser, props.usernames[0], props.userIds[0], post.channel_id, post.root_id, 2);
        expect(actions.removePost).toHaveBeenCalledTimes(1);
        expect(actions.removePost).toHaveBeenCalledWith(post);
    });

    test('addChannelMember should have been called multiple times', async () => {
        const userIds = ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'];
        const usernames = ['username_1', 'username_2', 'username_3', 'username_4'];
        const actions = {
            removePost: vi.fn(),
            addChannelMember: vi.fn(),
        };
        const props: Props = {...requiredProps, userIds, usernames, actions};
        renderWithContext(
            <PostAddChannelMember {...props}/>,
        );

        const addLink = screen.getByText('add them to the channel');
        await userEvent.click(addLink);
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
        const {container} = renderWithContext(<PostAddChannelMember {...props}/>);
        expect(container.querySelector('.PostBody_addChannelMemberLink')).not.toBeInTheDocument();
    });

    test('should show single consolidated message for ABAC channels regardless of user types', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['user1', 'user2'],
            noGroupsUsernames: ['user3'],
            isPolicyEnforced: true,
        };
        const {container} = renderWithContext(<PostAddChannelMember {...props}/>);

        // Should render only one consolidated message with no invite links
        const paragraphs = container.querySelectorAll('p');
        expect(paragraphs).toHaveLength(1);
        expect(container.querySelector('.PostBody_addChannelMemberLink')).not.toBeInTheDocument();
    });
});
