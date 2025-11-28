// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import range from 'lodash/range';
import React from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import MemberListGroup from './member_list_group';

describe('admin_console/team_channel_settings/group/GroupList', () => {
    const users = range(0, 15).map((i) => {
        return TestHelper.getUserMock({
            id: 'id' + i,
            username: 'username' + i,
            first_name: 'Name' + i,
            last_name: 'Surname' + i,
            email: 'test' + i + '@test.com',
        });
    });

    const actions = {
        getProfilesInGroup: vi.fn(),
        getGroupStats: vi.fn(),
        searchProfiles: vi.fn(),
        setModalSearchTerm: vi.fn(),
    };

    const baseProps = {
        searchTerm: '',
        users: [],
        groupID: 'group_id',
        total: 0,
        actions,
    };

    test('should match snapshot with no members', async () => {
        const {baseElement} = renderWithContext(<MemberListGroup {...baseProps}/>);

        // Wait for async state updates from useEffect
        await waitFor(() => {
            expect(actions.getProfilesInGroup).toHaveBeenCalled();
        });

        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot with members', async () => {
        const {baseElement} = renderWithContext(
            <MemberListGroup
                {...baseProps}
                users={users}
                total={15}
            />,
        );

        // Wait for async state updates from useEffect
        await waitFor(() => {
            expect(actions.getProfilesInGroup).toHaveBeenCalled();
        });

        expect(baseElement).toMatchSnapshot();
    });
});
