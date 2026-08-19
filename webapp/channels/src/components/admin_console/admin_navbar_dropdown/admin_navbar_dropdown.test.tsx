// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {deferNavigation} from 'actions/admin_actions';
import * as GlobalActions from 'actions/global_actions';
import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {ModalIdentifiers} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import AdminNavbarDropdown from './admin_navbar_dropdown';

jest.mock('actions/views/modals', () => ({
    openModal: jest.fn(() => ({type: 'MOCK_OPEN_MODAL'})),
}));

jest.mock('actions/global_actions', () => ({
    emitUserLoggedOutEvent: jest.fn(),
}));

jest.mock('actions/admin_actions', () => ({
    deferNavigation: jest.fn((callback) => ({type: 'MOCK_DEFER_NAVIGATION', callback})),
}));

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

    const openModalMock = openModal as jest.Mock;
    const emitUserLoggedOutEventMock = GlobalActions.emitUserLoggedOutEvent as jest.Mock;
    const deferNavigationMock = deferNavigation as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        window.open = jest.fn();
    });

    function renderDropdown(
        teams: Record<string, typeof team1>,
        options: {
            isLicensed?: boolean;
            navigationBlocked?: boolean;
        } = {},
    ) {
        const teamIds = Object.keys(teams);
        const initialState: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config: {
                        SiteName: 'Mattermost',
                    },
                    license: {
                        IsLicensed: options.isLicensed === false ? 'false' : 'true',
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
            views: {
                admin: {
                    navigationBlock: {
                        blocked: options.navigationBlocked ?? false,
                    },
                },
            },
        };

        const history = createMemoryHistory({initialEntries: ['/admin_console']});

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
            {history},
        );
    }

    async function openMenu() {
        await userEvent.click(screen.getByRole('button', {name: 'Open menu'}));
    }

    test('should not show Switch teams when user has only one team', async () => {
        renderDropdown({[team1.id]: team1});

        await openMenu();

        expect(screen.queryByRole('menuitem', {name: 'Switch teams'})).not.toBeInTheDocument();
    });

    test('should show Switch teams link when user has no teams', async () => {
        renderDropdown({});

        await openMenu();

        expect(screen.getByRole('menuitem', {name: 'Switch teams'})).toBeInTheDocument();
    });

    test('should show Switch teams submenu with team names when user has multiple teams', async () => {
        renderDropdown({
            [team1.id]: team1,
            [team2.id]: team2,
        });

        await openMenu();

        expect(screen.getByText('Switch teams')).toBeInTheDocument();

        await userEvent.hover(screen.getByText('Switch teams'));

        expect(await screen.findByText('Team One')).toBeInTheDocument();
        expect(screen.getByText('Team Two')).toBeInTheDocument();
    });

    test('should open external link for Administrator\'s Guide', async () => {
        renderDropdown({[team1.id]: team1});

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: "Administrator's Guide"}));

        expect(window.open).toHaveBeenCalledWith(
            'https://docs.mattermost.com/guides/administration.html',
            '_blank',
            'noopener noreferrer',
        );
    });

    test('should open Commercial Support modal when licensed', async () => {
        renderDropdown({[team1.id]: team1}, {isLicensed: true});

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Commercial Support'}));

        expect(openModalMock).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.COMMERCIAL_SUPPORT,
            dialogType: expect.any(Function),
        });
        expect(window.open).not.toHaveBeenCalled();
    });

    test('should open external Commercial Support link when unlicensed', async () => {
        renderDropdown({[team1.id]: team1}, {isLicensed: false});

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Commercial Support'}));

        expect(window.open).toHaveBeenCalledWith(
            'https://mattermost.com/support/',
            '_blank',
            'noopener noreferrer',
        );
        expect(openModalMock).not.toHaveBeenCalled();
    });

    test('should open About modal', async () => {
        renderDropdown({[team1.id]: team1});

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'About Mattermost'}));

        expect(openModalMock).toHaveBeenCalledWith({
            modalId: ModalIdentifiers.ABOUT,
            dialogType: expect.any(Function),
        });
    });

    test('should log out immediately when navigation is not blocked', async () => {
        renderDropdown({[team1.id]: team1});

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Log Out'}));

        expect(emitUserLoggedOutEventMock).toHaveBeenCalled();
        expect(deferNavigationMock).not.toHaveBeenCalled();
    });

    test('should defer logout when navigation is blocked', async () => {
        renderDropdown({[team1.id]: team1}, {navigationBlocked: true});

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Log Out'}));

        expect(deferNavigationMock).toHaveBeenCalledWith(emitUserLoggedOutEventMock);
        expect(emitUserLoggedOutEventMock).not.toHaveBeenCalled();
    });
});
