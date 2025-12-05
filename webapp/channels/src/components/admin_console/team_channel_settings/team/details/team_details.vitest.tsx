// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamDetails from './team_details';

describe('admin_console/team_channel_settings/team/TeamDetails', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
            getTeam: vi.fn().mockResolvedValue([]),
            linkGroupSyncable: vi.fn(),
            patchTeam: vi.fn(),
            setNavigationBlocked: vi.fn(),
            unlinkGroupSyncable: vi.fn(),
            getGroups: vi.fn().mockResolvedValue([]),
            membersMinusGroupMembers: vi.fn(),
            patchGroupSyncable: vi.fn(),
            addUserToTeam: vi.fn(),
            removeUserFromTeam: vi.fn(),
            updateTeamMemberSchemeRoles: vi.fn(),
            deleteTeam: vi.fn(),
            unarchiveTeam: vi.fn(),
        },
    };

    test('should match snapshot', async () => {
        const {container} = renderWithContext(
            <TeamDetails
                {...baseProps}
            />,
        );
        await waitFor(() => {
            expect(baseProps.actions.getTeam).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with isLocalArchived true', async () => {
        const props = {
            ...baseProps,
            team: {
                ...baseProps.team,
                delete_at: 16465313,
            },
        };
        const {container} = renderWithContext(
            <TeamDetails
                {...props}
            />,
        );
        await waitFor(() => {
            expect(baseProps.actions.getTeam).toHaveBeenCalled();
        });
        expect(container).toMatchSnapshot();
    });
});
