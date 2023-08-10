// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import UserGroupsList from './user_groups_list';

import type {Group, GroupPermissions} from '@mattermost/types/groups';

describe('component/user_groups_modal', () => {
    const baseProps = {
        onExited: jest.fn(),
        onScroll: jest.fn(),
        groups: [],
        searchTerm: '',
        backButtonAction: jest.fn(),
        groupPermissionsMap: {},
        loading: false,
        actions: {
            openModal: jest.fn(),
            archiveGroup: jest.fn(),
        },
    };

    function getGroups(numberOfGroups: number) {
        const groups: Group[] = [];
        for (let i = 0; i < numberOfGroups; i++) {
            groups.push({
                id: `group${i}`,
                name: `group${i}`,
                display_name: `Group ${i}`,
                description: `Group ${i} description`,
                source: 'custom',
                remote_id: null,
                create_at: 1637349374137,
                update_at: 1637349374137,
                delete_at: 0,
                has_syncables: false,
                member_count: i + 1,
                allow_reference: true,
                scheme_admin: false,
            });
        }

        return groups;
    }

    function getPermissions(groups: Group[]) {
        const groupPermissionsMap: Record<string, GroupPermissions> = {};
        groups.forEach((g) => {
            groupPermissionsMap[g.id] = {
                can_delete: true,
                can_manage_members: true,
            };
        });

        return groupPermissionsMap;
    }

    test('should match snapshot without groups', () => {
        const wrapper = shallow(
            <UserGroupsList
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with groups', () => {
        const groups = getGroups(3);
        const permissions = getPermissions(groups);

        const wrapper = shallow(
            <UserGroupsList
                {...baseProps}
                groups={groups}
                groupPermissionsMap={permissions}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
