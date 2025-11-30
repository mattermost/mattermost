// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {General, Posts} from 'mattermost-redux/constants';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

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
            getMissingProfilesByIds: vi.fn(),
            getMissingProfilesByUsernames: vi.fn(),
        },
    };

    const initialState = {
        entities: {
            general: {config: {}},
            users: {
                currentUserId: 'current_user_id',
                profiles: userProfiles.reduce((acc, user) => {
                    acc[user.id] = user;
                    return acc;
                }, {} as Record<string, UserProfile>),
            },
            groups: {groups: {}, myGroups: []},
            emojis: {customEmoji: {}},
            channels: {},
            teams: {
                teams: {},
            },
            preferences: {
                myPreferences: {},
            },
        },
    } as any;

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <CombinedSystemMessage {...baseProps}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when join leave messages are turned off', () => {
        const {container} = renderWithContext(
            <CombinedSystemMessage
                {...baseProps}
                showJoinLeave={false}
            />,
            initialState,
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
            initialState,
        );

        expect(container).toMatchSnapshot();
    });

    test('should call getMissingProfilesByIds and/or getMissingProfilesByUsernames on loadUserProfiles', () => {
        const props = {
            ...baseProps,
            allUserIds: [],
            actions: {
                getMissingProfilesByIds: vi.fn(),
                getMissingProfilesByUsernames: vi.fn(),
            },
        };

        const {rerender} = renderWithContext(
            <CombinedSystemMessage {...props}/>,
            initialState,
        );

        // The component uses useEffect to load user profiles, so we need to trigger it
        // by changing allUserIds or allUsernames
        const propsWithIds = {
            ...props,
            allUserIds: ['user_id_1'],
        };
        rerender(<CombinedSystemMessage {...propsWithIds}/>);

        expect(props.actions.getMissingProfilesByIds).toHaveBeenCalledWith(['user_id_1']);

        const propsWithBoth = {
            ...props,
            allUserIds: ['user_id_1', 'user_id_2'],
            allUsernames: ['user1'],
        };
        rerender(<CombinedSystemMessage {...propsWithBoth}/>);

        expect(props.actions.getMissingProfilesByIds).toHaveBeenCalledWith(['user_id_1', 'user_id_2']);
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
        const {container} = renderWithContext(
            <CombinedSystemMessage {...props}/>,
            initialState,
        );

        expect(container).toMatchSnapshot();
    });
});
