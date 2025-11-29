// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UsersToRemoveRole from './users_to_remove_role';

describe('components/admin_console/team_channel_settings/group/UsersToRemoveRole', () => {
    const groups = [TestHelper.getGroupMock({id: 'group1', display_name: 'group1'})];
    const userWithGroups = {
        ...TestHelper.getUserMock(),
        groups,
    };

    const adminUserWithGroups = {
        ...TestHelper.getUserMock({roles: 'system_admin system_user'}),
        groups,
    };

    const guestUserWithGroups = {
        ...TestHelper.getUserMock({roles: 'system_guest'}),
        groups,
    };

    const teamMembership = TestHelper.getTeamMembershipMock({scheme_admin: false});
    const adminTeamMembership = TestHelper.getTeamMembershipMock({scheme_admin: true});
    const channelMembership = TestHelper.getChannelMembershipMock({scheme_admin: false}, {});
    const adminChannelMembership = TestHelper.getChannelMembershipMock({scheme_admin: true}, {});
    const guestMembership = TestHelper.getTeamMembershipMock({scheme_admin: false, scheme_user: false});

    const scopeTeam: 'team' | 'channel' = 'team';
    const scopeChannel: 'team' | 'channel' = 'channel';

    test('should match snapshot scope team and regular membership', () => {
        const {container} = renderWithContext(
            <UsersToRemoveRole
                user={userWithGroups}
                scope={scopeTeam}
                membership={teamMembership}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot scope team and admin membership', () => {
        const {container} = renderWithContext(
            <UsersToRemoveRole
                user={userWithGroups}
                scope={scopeTeam}
                membership={adminTeamMembership}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot scope channel and regular membership', () => {
        const {container} = renderWithContext(
            <UsersToRemoveRole
                user={userWithGroups}
                scope={scopeChannel}
                membership={channelMembership}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot scope channel and admin membership', () => {
        const {container} = renderWithContext(
            <UsersToRemoveRole
                user={userWithGroups}
                scope={scopeChannel}
                membership={adminChannelMembership}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot scope channel and admin membership but user is sys admin', () => {
        const {container} = renderWithContext(
            <UsersToRemoveRole
                user={adminUserWithGroups}
                scope={scopeChannel}
                membership={adminChannelMembership}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot guest', () => {
        const {container} = renderWithContext(
            <UsersToRemoveRole
                user={guestUserWithGroups}
                scope={scopeTeam}
                membership={guestMembership}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
