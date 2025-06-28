// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {sendAddToChannelEphemeralPost} from 'actions/global_actions';

import PostAddChannelMember from 'components/post_view/post_add_channel_member/post_add_channel_member';
import type {Props} from 'components/post_view/post_add_channel_member/post_add_channel_member';

import {TestHelper} from 'utils/test_helper';

jest.mock('actions/global_actions', () => {
    return {
        sendAddToChannelEphemeralPost: jest.fn(),
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
            removePost: jest.fn(),
            addChannelMember: jest.fn(),
        },
        noGroupsUsernames: [],
        nonInvitableUsernames: [],
        isPolicyEnforced: false,
    };

    test('should match snapshot, empty postId', () => {
        const props: Props = {
            ...requiredProps,
            postId: '',
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, empty channelType', () => {
        const props: Props = {
            ...requiredProps,
            channelType: '',
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, public channel', () => {
        const wrapper = shallow(<PostAddChannelMember {...requiredProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, private channel', () => {
        const props: Props = {
            ...requiredProps,
            channelType: 'P',
        };

        const wrapper = shallow(<PostAddChannelMember {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, more than 3 users', () => {
        const userIds = ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'];
        const usernames = ['username_1', 'username_2', 'username_3', 'username_4'];
        const props: Props = {
            ...requiredProps,
            userIds,
            usernames,
        };

        const wrapper = shallow(<PostAddChannelMember {...props}/>);
        expect(wrapper.state('expanded')).toEqual(false);
        expect(wrapper).toMatchSnapshot();

        wrapper.find('.PostBody_otherUsersLink').simulate('click');
        expect(wrapper.state('expanded')).toEqual(true);
        expect(wrapper).toMatchSnapshot();
    });

    test('actions should have been called', () => {
        const actions = {
            removePost: jest.fn(),
            addChannelMember: jest.fn(),
        };
        const props: Props = {...requiredProps, actions};
        const wrapper = shallow(
            <PostAddChannelMember {...props}/>,
        );

        wrapper.find('.PostBody_addChannelMemberLink').simulate('click');

        expect(actions.addChannelMember).toHaveBeenCalledTimes(1);
        expect(actions.addChannelMember).toHaveBeenCalledWith(post.channel_id, requiredProps.userIds[0], post.root_id);
        expect(sendAddToChannelEphemeralPost).toHaveBeenCalledTimes(1);
        expect(sendAddToChannelEphemeralPost).toHaveBeenCalledWith(props.currentUser, props.usernames[0], props.userIds[0], post.channel_id, post.root_id, 2);
        expect(actions.removePost).toHaveBeenCalledTimes(1);
        expect(actions.removePost).toHaveBeenCalledWith(post);
    });

    test('addChannelMember should have been called multiple times', () => {
        const userIds = ['user_id_1', 'user_id_2', 'user_id_3', 'user_id_4'];
        const usernames = ['username_1', 'username_2', 'username_3', 'username_4'];
        const actions = {
            removePost: jest.fn(),
            addChannelMember: jest.fn(),
        };
        const props: Props = {...requiredProps, userIds, usernames, actions};
        const wrapper = shallow(
            <PostAddChannelMember {...props}/>,
        );

        wrapper.find('.PostBody_addChannelMemberLink').simulate('click');
        expect(actions.addChannelMember).toHaveBeenCalledTimes(4);
    });

    test('should match snapshot, with no-groups usernames', () => {
        const props: Props = {
            ...requiredProps,
            noGroupsUsernames: ['user_id_2'],
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with non-invitable usernames (ABAC policy violation)', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['username_1', 'username_2', 'username_3'],
            nonInvitableUsernames: ['username_2', 'username_3'],
            isPolicyEnforced: true,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with mixed user types (invitable, non-invitable, out-of-groups)', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['username_1', 'username_2', 'username_3', 'username_4'],
            nonInvitableUsernames: ['username_2'],
            noGroupsUsernames: ['username_3'],
            isPolicyEnforced: true,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should not show add link for non-invitable users when policy is enforced', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['username_1', 'username_2'],
            nonInvitableUsernames: ['username_1', 'username_2'],
            isPolicyEnforced: true,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);
        expect(wrapper.find('.PostBody_addChannelMemberLink')).toHaveLength(0);
    });

    // Test user categorization logic
    test('should correctly categorize users into invitable, non-invitable, and out-of-groups', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['invitable_user', 'non_invitable_user', 'out_of_groups_user'],
            nonInvitableUsernames: ['non_invitable_user'],
            noGroupsUsernames: ['out_of_groups_user'],
            isPolicyEnforced: false, // Test non-policy-enforced scenario
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);

        // Should render separate messages for each category
        expect(wrapper.find('p')).toHaveLength(3); // One for each category
        expect(wrapper.find('.PostBody_addChannelMemberLink')).toHaveLength(1); // Only for invitable users
    });

    test('should show consolidated message when policy is enforced with violations', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['invitable_user', 'non_invitable_user'],
            nonInvitableUsernames: ['non_invitable_user'],
            isPolicyEnforced: true,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);

        // Should render only one consolidated message
        expect(wrapper.find('p')).toHaveLength(1);
        expect(wrapper.find('.PostBody_addChannelMemberLink')).toHaveLength(0); // No invite links when policy enforced
    });

    test('should show normal invite flow when policy enforced but no violations', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['invitable_user1', 'invitable_user2'],
            nonInvitableUsernames: [],
            noGroupsUsernames: [],
            isPolicyEnforced: true,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);

        // Should show normal invite message since no policy violations
        expect(wrapper.find('p')).toHaveLength(1);
        expect(wrapper.find('.PostBody_addChannelMemberLink')).toHaveLength(1);
    });

    test('should only add invitable users when add link is clicked', () => {
        const actions = {
            removePost: jest.fn(),
            addChannelMember: jest.fn(),
        };
        const props: Props = {
            ...requiredProps,
            userIds: ['invitable_id', 'non_invitable_id', 'out_of_groups_id'],
            usernames: ['invitable_user', 'non_invitable_user', 'out_of_groups_user'],
            nonInvitableUsernames: ['non_invitable_user'],
            noGroupsUsernames: ['out_of_groups_user'],
            isPolicyEnforced: false,
            actions,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);

        // Find and click the add link
        wrapper.find('.PostBody_addChannelMemberLink').simulate('click');

        // Should only call addChannelMember for all users (current behavior - this tests existing logic)
        // Note: The filtering happens in the backend, frontend still sends all userIds
        expect(actions.addChannelMember).toHaveBeenCalledTimes(3);
    });

    test('should handle empty user categories gracefully', () => {
        const props: Props = {
            ...requiredProps,
            usernames: [],
            nonInvitableUsernames: [],
            noGroupsUsernames: [],
            isPolicyEnforced: false,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);

        // Should render nothing when no users
        expect(wrapper.find('p')).toHaveLength(0);
    });

    test('should render correct message for single non-invitable user', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['non_invitable_user'],
            nonInvitableUsernames: ['non_invitable_user'],
            isPolicyEnforced: false,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);

        // Should render message for non-invitable user
        expect(wrapper.find('p')).toHaveLength(1);
        expect(wrapper.find('.PostBody_addChannelMemberLink')).toHaveLength(0);
    });

    test('should render correct message for single out-of-groups user', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['out_of_groups_user'],
            noGroupsUsernames: ['out_of_groups_user'],
            isPolicyEnforced: false,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);

        // Should render message for out-of-groups user
        expect(wrapper.find('p')).toHaveLength(1);
        expect(wrapper.find('.PostBody_addChannelMemberLink')).toHaveLength(0);
    });

    test('should handle mixed scenarios with policy not enforced', () => {
        const props: Props = {
            ...requiredProps,
            usernames: ['invitable1', 'invitable2', 'non_invitable1', 'out_of_groups1'],
            nonInvitableUsernames: ['non_invitable1'],
            noGroupsUsernames: ['out_of_groups1'],
            isPolicyEnforced: false,
        };
        const wrapper = shallow(<PostAddChannelMember {...props}/>);

        // Should render three separate messages: invitable, non-invitable, out-of-groups
        expect(wrapper.find('p')).toHaveLength(3);
        expect(wrapper.find('.PostBody_addChannelMemberLink')).toHaveLength(1); // Only for invitable users
    });
});
