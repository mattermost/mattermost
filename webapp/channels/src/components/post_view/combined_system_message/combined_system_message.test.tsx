// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {General, Posts} from 'mattermost-redux/constants';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import CombinedSystemMessage from './combined_system_message';

import type {CombinedSystemMessage as CombinedSystemMessageType} from './combined_system_message';
import type {UserProfile} from '@mattermost/types/users';
import type {ActionFunc} from 'mattermost-redux/types/actions';

describe('components/post_view/CombinedSystemMessage', () => {
    function emptyFunc() {} // eslint-disable-line no-empty-function
    const userProfiles = [
        {id: 'added_user_id_1', username: 'AddedUser1'},
        {id: 'added_user_id_2', username: 'AddedUser2'},
        {id: 'removed_user_id_1', username: 'removed_username_1'},
        {id: 'removed_user_id_2', username: 'removed_username_2'},
        {id: 'current_user_id', username: 'current_username'},
        {id: 'other_user_id', username: 'other_username'},
        {id: 'user_id_1', username: 'User1'},
        {id: 'user_id_2', username: 'User2'},
    ] as unknown as UserProfile[];

    const baseProps = {
        currentUserId: 'current_user_id',
        currentUsername: 'current_username',
        allUserIds: ['added_user_id_1', 'added_user_id_2', 'current_user_id', 'user_id_1'],
        allUsernames: [],
        messageData: [{
            actorId: 'user_id_1',
            postType: Posts.POST_TYPES.ADD_TO_CHANNEL,
            userIds: ['added_user_id_1'],
        }, {
            actorId: 'user_id_1',
            postType: Posts.POST_TYPES.ADD_TO_CHANNEL,
            userIds: ['current_user_id'],
        }, {
            actorId: 'current_user_id',
            postType: Posts.POST_TYPES.ADD_TO_CHANNEL,
            userIds: ['added_user_id_2'],
        }],
        showJoinLeave: true,
        teammateNameDisplay: General.TEAMMATE_NAME_DISPLAY.SHOW_USERNAME,
        userProfiles,
        actions: {
            getMissingProfilesByIds: emptyFunc as unknown as (userIds: string[]) => ActionFunc,
            getMissingProfilesByUsernames: emptyFunc as unknown as (usernames: string[]) => ActionFunc,
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallowWithIntl(
            <CombinedSystemMessage {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when join leave messages are turned off', () => {
        const wrapper = shallowWithIntl(
            <CombinedSystemMessage
                {...baseProps}
                showJoinLeave={false}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, "removed from channel" message when join leave messages are turned off', () => {
        const allUserIds = ['current_user_id', 'other_user_id_1', 'removed_user_id_1', 'removed_user_id_2'];
        const messageData = [{
            actorId: 'current_user_id',
            postType: Posts.POST_TYPES.REMOVE_FROM_CHANNEL,
            userIds: ['removed_user_id_1'],
        }, {
            actorId: 'other_user_id_1',
            postType: Posts.POST_TYPES.REMOVE_FROM_CHANNEL,
            userIds: ['removed_user_id_2'],
        }];
        const props = {...baseProps, messageData, allUserIds, showJoinLeave: false};
        const wrapper = shallowWithIntl(
            <CombinedSystemMessage {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should call getMissingProfilesByIds and/or getMissingProfilesByUsernames on loadUserProfiles', () => {
        const props = {
            ...baseProps,
            allUserIds: [],
            actions: {
                getMissingProfilesByIds: jest.fn(),
                getMissingProfilesByUsernames: jest.fn(),
            },
        };

        const wrapper = shallowWithIntl(
            <CombinedSystemMessage {...props}/>,
        );

        const instance = wrapper.instance() as CombinedSystemMessageType;

        instance.loadUserProfiles([], []);
        expect(props.actions.getMissingProfilesByIds).toHaveBeenCalledTimes(0);
        expect(props.actions.getMissingProfilesByUsernames).toHaveBeenCalledTimes(0);

        instance.loadUserProfiles(['user_id_1'], []);
        expect(props.actions.getMissingProfilesByIds).toHaveBeenCalledTimes(1);
        expect(props.actions.getMissingProfilesByIds).toHaveBeenCalledWith(['user_id_1']);
        expect(props.actions.getMissingProfilesByUsernames).toHaveBeenCalledTimes(0);

        instance.loadUserProfiles(['user_id_1', 'user_id_2'], ['user1']);
        expect(props.actions.getMissingProfilesByIds).toHaveBeenCalledTimes(2);
        expect(props.actions.getMissingProfilesByIds).toHaveBeenCalledWith(['user_id_1', 'user_id_2']);
        expect(props.actions.getMissingProfilesByUsernames).toHaveBeenCalledTimes(1);
        expect(props.actions.getMissingProfilesByUsernames).toHaveBeenCalledWith(['user1']);
    });
    test('should render messages in chronological order', () => {
        const allUserIds = ['current_user_id', 'other_user_id_1', 'user_id_1', 'user_id_2', 'join_last'];
        const messageData = [{
            actorId: 'current_user_id',
            postType: Posts.POST_TYPES.REMOVE_FROM_CHANNEL,
            userIds: ['removed_user_id_1'],
        }, {
            actorId: 'other_user_id_1',
            postType: Posts.POST_TYPES.ADD_TO_CHANNEL,
            userIds: ['removed_user_id_2'],
        }, {
            actorId: 'other_user_id_1',
            postType: Posts.POST_TYPES.REMOVE_FROM_CHANNEL,
            userIds: ['removed_user_id_2'],
        }, {
            actorId: 'user_id_1',
            postType: Posts.POST_TYPES.ADD_TO_CHANNEL,
            userIds: ['user_id_2'],
        }, {
            actorId: 'join_last',
            postType: Posts.POST_TYPES.JOIN_CHANNEL,
            userIds: [''],
        }];
        const props = {...baseProps, messageData, allUserIds};
        const wrapper = shallowWithIntl(
            <CombinedSystemMessage {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
