// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import AddUsersToGroupModal from './add_users_to_group_modal';

describe('component/add_users_to_group_modal', () => {
    const baseProps = {
        onExited: jest.fn(),
        backButtonCallback: jest.fn(),
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
        actions: {
            openModal: jest.fn(),
            addUsersToGroup: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <AddUsersToGroupModal
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
