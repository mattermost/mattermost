// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as UserAgent from '@mattermost/shared/utils/user_agent';

import {Permissions} from 'mattermost-redux/constants';

import type {MockIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen} from 'tests/react_testing_utils';

import {MobileSidebarRightItems} from './mobile_sidebar_right_items';
import type {Props} from './mobile_sidebar_right_items';

const isDesktopAppMock = jest.mocked(UserAgent.isDesktopApp);

jest.mock('@mattermost/shared/utils/user_agent', () => ({
    isDesktopApp: jest.fn(() => false),
}));

describe('MobileSidebarRightItems', () => {
    const defaultProps: Props = {
        teamId: 'team-id',
        teamName: 'team_name',
        appDownloadLink: undefined,
        experimentalPrimaryTeam: undefined,
        helpLink: undefined,
        reportAProblemLink: '',
        moreTeamsToJoin: false,
        pluginMenuItems: [],
        isMentionSearch: false,
        usageDeltaTeams: 0,
        siteName: 'site-name',
        isLicensedForLDAPGroups: false,
        guestAccessEnabled: true,
        actions: {
            showMentions: jest.fn(),
            showFlaggedPosts: jest.fn(),
            closeRightHandSide: jest.fn(),
            closeRhsMenu: jest.fn(),
            openModal: jest.fn(),
        },
        teamIsGroupConstrained: false,
        isStarterFree: false,
        isFreeTrial: false,
        userId: 'test-user-id',
        profilePicture: 'http://localhost/api/v4/users/test-user-id/image',
        autoResetPref: '',
        status: 'online',
        customStatus: undefined,
        isCustomStatusExpired: false,
        isCustomStatusEnabled: false,
        timezone: '',
        intl: {
            formatMessage: ({defaultMessage}) => defaultMessage,
        } as MockIntl,
    };

    const defaultState = {
        entities: {
            channels: {
                myMembers: {},
            },
            general: {
                config: {},
                license: {
                    Cloud: 'false',
                },
            },
            teams: {
                currentTeamId: 'team-id',
                myMembers: {
                    'team-id': {
                        team_id: 'team-id',
                        user_id: 'test-user-id',
                        roles: 'team_user',
                        scheme_user: true,
                    },
                },
            },
            users: {
                currentUserId: 'test-user-id',
                profiles: {
                    'test-user-id': {
                        id: 'test-user-id',
                        roles: 'system_user system_admin',
                    },
                },
            },
            roles: {
                roles: {
                    system_admin: {
                        permissions: [
                            Permissions.CREATE_TEAM,
                            Permissions.SYSCONSOLE_WRITE_PLUGINS,
                        ],
                    },
                },
            },
        },
    };

    test('should render basic menu items', () => {
        renderWithContext(<MobileSidebarRightItems {...defaultProps}/>, defaultState);
        expect(screen.getByText('Recent Mentions')).toBeInTheDocument();
        expect(screen.getByText('Saved messages')).toBeInTheDocument();
        expect(screen.getByText('Profile')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    test('should show leave team option when primary team is not set', () => {
        renderWithContext(
            <MobileSidebarRightItems
                {...defaultProps}
                teamIsGroupConstrained={false}
                experimentalPrimaryTeam={undefined}
            />,
            defaultState,
        );
        expect(screen.getByText('Leave Team')).toBeInTheDocument();
    });

    test('should hide leave team option when team is group constrained', () => {
        renderWithContext(
            <MobileSidebarRightItems
                {...defaultProps}
                teamIsGroupConstrained={true}
            />,
            defaultState,
        );
        expect(screen.queryByText('Leave Team')).not.toBeInTheDocument();
    });

    test('should show create team option with proper permissions', () => {
        renderWithContext(<MobileSidebarRightItems {...defaultProps}/>, defaultState);
        expect(screen.getByText('Create a Team')).toBeInTheDocument();
    });

    test('should show plugins when provided', () => {
        const pluginMenuItems = [
            {
                id: 'plugin-1',
                pluginId: 'plugin-1',
                mobileIcon: <i className='fa fa-anchor'/>,
                action: jest.fn(),
                text: 'Plugin Item 1',
            },
        ];
        renderWithContext(
            <MobileSidebarRightItems
                {...defaultProps}
                pluginMenuItems={pluginMenuItems}
            />,
            defaultState,
        );
        expect(screen.getByText('Plugin Item 1')).toBeInTheDocument();
    });

    test('should show help link when provided', () => {
        renderWithContext(
            <MobileSidebarRightItems
                {...defaultProps}
                helpLink='https://help.example.com'
            />,
            defaultState,
        );
        expect(screen.getByText('Help')).toBeInTheDocument();
    });

    test('should show Download Apps link when appDownloadLink is set and not in desktop app', () => {
        isDesktopAppMock.mockReturnValue(false);
        renderWithContext(
            <MobileSidebarRightItems
                {...defaultProps}
                appDownloadLink='https://downloads.example.com'
            />,
            defaultState,
        );
        expect(screen.getByText('Download Apps')).toBeInTheDocument();
    });

    test('should hide Download Apps link when in desktop app', () => {
        isDesktopAppMock.mockReturnValue(true);
        renderWithContext(
            <MobileSidebarRightItems
                {...defaultProps}
                appDownloadLink='https://downloads.example.com'
            />,
            defaultState,
        );
        expect(screen.queryByText('Download Apps')).not.toBeInTheDocument();
        isDesktopAppMock.mockReturnValue(false);
    });
});
