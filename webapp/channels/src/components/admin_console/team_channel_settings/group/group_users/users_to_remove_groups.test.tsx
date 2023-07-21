// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Group} from '@mattermost/types/groups';
import {UserProfile} from '@mattermost/types/users';
import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import UsersToRemoveGroups from './users_to_remove_groups';

describe('components/admin_console/team_channel_settings/group/UsersToRemoveGroups', () => {
    function userWithGroups(user: UserProfile, groups: Group[]) {
        return {
            ...user,
            groups,
        };
    }

    const user = TestHelper.getUserMock();
    const group1 = TestHelper.getGroupMock({id: 'group1', display_name: 'group1'});
    const group2 = TestHelper.getGroupMock({id: 'group2', display_name: 'group2'});
    const group3 = TestHelper.getGroupMock({id: 'group3', display_name: 'group3'});

    test('should match snapshot with 0 groups', () => {
        const wrapper = shallow(
            <UsersToRemoveGroups
                user={userWithGroups(user, [])}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with 1 group', () => {
        const wrapper = shallow(
            <UsersToRemoveGroups
                user={userWithGroups(user, [group1])}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with 3 groups', () => {
        const wrapper = shallow(
            <UsersToRemoveGroups
                user={userWithGroups(user, [group1, group2, group3])}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
