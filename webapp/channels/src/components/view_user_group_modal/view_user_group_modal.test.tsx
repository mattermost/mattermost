// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ViewUserGroupModal from './view_user_group_modal';

import type {UserProfile} from '@mattermost/types/users';

describe('component/view_user_group_modal', () => {
    const users = [
        {
            id: 'user-1',
            username: 'user1',
            first_name: 'user',
            last_name: 'one',
            delete_at: 0,
        } as UserProfile,
        {
            id: 'user-2',
            username: 'user2',
            first_name: 'user',
            last_name: 'otwo',
            delete_at: 0,
        } as UserProfile,
    ];

    const baseProps = {
        onExited: jest.fn(),
        searchTerm: '',
        groupId: 'groupid123',
        group: {
            id: 'groupid123',
            name: 'group',
            display_name: 'Group Name',
            description: 'Group description',
            source: 'custom',
            remote_id: null,
            create_at: 1637349374137,
            update_at: 1637349374137,
            delete_at: 0,
            has_syncables: false,
            member_count: 6,
            allow_reference: true,
            scheme_admin: false,
        },
        users,
        backButtonCallback: jest.fn(),
        backButtonAction: jest.fn(),
        currentUserId: 'user-1',
        permissionToEditGroup: true,
        permissionToJoinGroup: true,
        permissionToLeaveGroup: true,
        permissionToArchiveGroup: true,
        isGroupMember: false,
        actions: {
            getGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            getUsersInGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            setModalSearchTerm: jest.fn(),
            openModal: jest.fn(),
            searchProfiles: jest.fn().mockImplementation(() => Promise.resolve()),
            removeUsersFromGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            addUsersToGroup: jest.fn().mockImplementation(() => Promise.resolve()),
            archiveGroup: jest.fn().mockImplementation(() => Promise.resolve()),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <ViewUserGroupModal
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, search user1', () => {
        const wrapper = shallow(
            <ViewUserGroupModal
                {...baseProps}
                searchTerm='user1'
            />,
        );

        const instance = wrapper.instance() as ViewUserGroupModal;

        const e = {
            target: {
                value: '',
            },
        };
        instance.handleSearch(e as React.ChangeEvent<HTMLInputElement>);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(1);
        expect(baseProps.actions.setModalSearchTerm).toBeCalledWith('');

        e.target.value = 'user1';
        instance.handleSearch(e as React.ChangeEvent<HTMLInputElement>);
        expect(wrapper.state('loading')).toEqual(true);
        expect(baseProps.actions.setModalSearchTerm).toHaveBeenCalledTimes(2);
        expect(baseProps.actions.setModalSearchTerm).toBeCalledWith(e.target.value);
    });
});
