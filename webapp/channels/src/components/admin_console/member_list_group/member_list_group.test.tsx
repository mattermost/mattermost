// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import range from 'lodash/range';
import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
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
        getProfilesInGroup: jest.fn().mockResolvedValue({data: []}),
        getGroupStats: jest.fn().mockResolvedValue({data: {}}),
        searchProfiles: jest.fn().mockResolvedValue({data: []}),
        setModalSearchTerm: jest.fn(),
    };

    const baseProps = {
        searchTerm: '',
        users: [],
        groupID: 'group_id',
        total: 0,
        actions,
    };

    test('should match snapshot with no members', () => {
        const {container} = renderWithContext(<MemberListGroup {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with members', () => {
        const {container} = renderWithContext(
            <MemberListGroup
                {...baseProps}
                users={users}
                total={15}
            />);
        expect(container).toMatchSnapshot();
    });
});
