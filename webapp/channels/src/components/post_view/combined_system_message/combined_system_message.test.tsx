// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {General, Posts} from 'mattermost-redux/constants';

import {renderWithContext} from 'tests/react_testing_utils';

import CombinedSystemMessage from './combined_system_message';

describe('components/post_view/CombinedSystemMessage', () => {
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
            getMissingProfilesByIds: jest.fn(),
            getMissingProfilesByUsernames: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <CombinedSystemMessage {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when join leave messages are turned off', () => {
        const {container} = renderWithContext(
            <CombinedSystemMessage
                {...baseProps}
                showJoinLeave={false}
            />,
        );

        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(
            <CombinedSystemMessage {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should call getMissingProfilesByIds and/or getMissingProfilesByUsernames on loadUserProfiles', () => {
        // Test 1: empty allUserIds and allUsernames - should not call either action
        const actions1 = {
            getMissingProfilesByIds: jest.fn(),
            getMissingProfilesByUsernames: jest.fn(),
        };
        renderWithContext(
            <CombinedSystemMessage
                {...baseProps}
                allUserIds={[]}
                allUsernames={[]}
                actions={actions1}
            />,
        );
        expect(actions1.getMissingProfilesByIds).toHaveBeenCalledTimes(0);
        expect(actions1.getMissingProfilesByUsernames).toHaveBeenCalledTimes(0);

        // Test 2: with userIds only - should call getMissingProfilesByIds
        const actions2 = {
            getMissingProfilesByIds: jest.fn(),
            getMissingProfilesByUsernames: jest.fn(),
        };
        renderWithContext(
            <CombinedSystemMessage
                {...baseProps}
                allUserIds={['user_id_1']}
                allUsernames={[]}
                actions={actions2}
            />,
        );
        expect(actions2.getMissingProfilesByIds).toHaveBeenCalledTimes(1);
        expect(actions2.getMissingProfilesByIds).toHaveBeenCalledWith(['user_id_1']);
        expect(actions2.getMissingProfilesByUsernames).toHaveBeenCalledTimes(0);

        // Test 3: with both userIds and usernames - should call both actions
        const actions3 = {
            getMissingProfilesByIds: jest.fn(),
            getMissingProfilesByUsernames: jest.fn(),
        };
        renderWithContext(
            <CombinedSystemMessage
                {...baseProps}
                allUserIds={['user_id_1', 'user_id_2']}
                allUsernames={['user1']}
                actions={actions3}
            />,
        );
        expect(actions3.getMissingProfilesByIds).toHaveBeenCalledTimes(1);
        expect(actions3.getMissingProfilesByIds).toHaveBeenCalledWith(['user_id_1', 'user_id_2']);
        expect(actions3.getMissingProfilesByUsernames).toHaveBeenCalledTimes(1);
        expect(actions3.getMissingProfilesByUsernames).toHaveBeenCalledWith(['user1']);
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
        const {container} = renderWithContext(
            <CombinedSystemMessage {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
