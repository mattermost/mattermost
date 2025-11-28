// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi} from 'vitest';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import AddUsersToGroupModal from './add_users_to_group_modal';

describe('component/add_users_to_group_modal', () => {
    const baseProps = {
        onExited: vi.fn(),
        backButtonCallback: vi.fn(),
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
            openModal: vi.fn(),
            addUsersToGroup: vi.fn(),
        },
    };

    test('should match snapshot', () => {
        const {baseElement} = renderWithContext(
            <AddUsersToGroupModal
                {...baseProps}
            />,
        );
        expect(baseElement).toMatchSnapshot();
    });
});
