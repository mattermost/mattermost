// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import * as Menu from 'components/menu';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import AdminNavbarDropdown from './admin_navbar_dropdown';

describe('components/admin_console/admin_navbar_dropdown', () => {
    const team1 = TestHelper.getTeamMock({
        id: 'team-1',
        name: 'team-one',
        display_name: 'Team One',
    });
    const team2 = TestHelper.getTeamMock({
        id: 'team-2',
        name: 'team-two',
        display_name: 'Team Two',
    });

    function renderDropdown(teams: Record<string, typeof team1>) {
        const teamIds = Object.keys(teams);
        const initialState: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config: {
                        SiteName: 'Mattermost',
                    },
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'false',
                    },
                },
                teams: {
                    teams,
                    myMembers: teamIds.reduce<Record<string, {roles: string}>>((members, id) => {
                        members[id] = {roles: 'team_user'};
                        return members;
                    }, {}),
                },
                users: {
                    currentUserId: 'current-user-id',
                    profiles: {
                        'current-user-id': TestHelper.getUserMock({id: 'current-user-id'}),
                    },
                },
            },
        };

        return renderWithContext(
            <Menu.Container
                menuButton={{
                    id: 'admin-sidebar-header',
                    children: <span>{'Open menu'}</span>,
                }}
                menu={{
                    id: 'adminConsoleMenu',
                    'aria-label': 'Admin Console Menu',
                }}
            >
                <AdminNavbarDropdown/>
            </Menu.Container>,
            initialState,
        );
    }

    test('should hide Switch teams when user has only one team', async () => {
        renderDropdown({[team1.id]: team1});

        await userEvent.click(screen.getByRole('button', {name: 'Open menu'}));

        expect(screen.queryByText('Switch teams')).not.toBeInTheDocument();
        expect(screen.getByText('Log Out')).toBeInTheDocument();
    });

    test('should show Switch teams submenu when user has multiple teams', async () => {
        renderDropdown({
            [team1.id]: team1,
            [team2.id]: team2,
        });

        await userEvent.click(screen.getByRole('button', {name: 'Open menu'}));

        expect(screen.getByText('Switch teams')).toBeInTheDocument();
    });

    test('should show Switch teams link when user has no teams', async () => {
        renderDropdown({});

        await userEvent.click(screen.getByRole('button', {name: 'Open menu'}));

        expect(screen.getByText('Switch teams')).toBeInTheDocument();
    });
});
