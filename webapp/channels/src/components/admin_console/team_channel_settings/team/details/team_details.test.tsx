// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import TeamDetails from './team_details';

describe('admin_console/team_channel_settings/team/TeamDetails', () => {
    const groups = [TestHelper.getGroupMock({
        id: '123',
        display_name: 'DN',
        member_count: 3,
    })];
    const allGroups = {
        123: groups[0],
    };
    const testTeam = TestHelper.getTeamMock({
        id: '123',
        allow_open_invite: false,
        allowed_domains: '',
        group_constrained: false,
        display_name: 'team',
        delete_at: 0,
    });

    const baseProps = {
        groups,
        totalGroups: groups.length,
        team: testTeam,
        teamID: testTeam.id,
        allGroups,
        actions: {
            getTeam: jest.fn().mockResolvedValue([]),
            linkGroupSyncable: jest.fn(),
            patchTeam: jest.fn(),
            setNavigationBlocked: jest.fn(),
            unlinkGroupSyncable: jest.fn(),
            getGroups: jest.fn().mockResolvedValue([]),
            membersMinusGroupMembers: jest.fn(),
            patchGroupSyncable: jest.fn(),
            addUserToTeam: jest.fn(),
            removeUserFromTeam: jest.fn(),
            updateTeamMemberSchemeRoles: jest.fn(),
            deleteTeam: jest.fn(),
            unarchiveTeam: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <TeamDetails
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with isLocalArchived true', () => {
        const props = {
            ...baseProps,
            team: {
                ...baseProps.team,
                delete_at: 16465313,
            },
        };
        const wrapper = shallow(
            <TeamDetails
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
