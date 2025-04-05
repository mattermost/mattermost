// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import MainMenu from 'components/main_menu/main_menu';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('plugins/MainMenuActions', () => {
    const pluginAction = jest.fn();

    const requiredProps: ComponentProps<typeof MainMenu> = {
        teamId: 'someteamid',
        teamName: 'somename',
        currentUser: {id: 'someuserid', roles: 'system_user'} as UserProfile,
        enableCommands: true,
        enableIncomingWebhooks: true,
        enableOutgoingWebhooks: true,
        enableOAuthServiceProvider: true,
        canManageSystemBots: true,
        pluginMenuItems: [{
            id: 'someplugin',
            pluginId: 'test',
            text: 'some plugin text',
            action: pluginAction,
            mobileIcon: <i className={'fa fa-anchor'}/>,
        }],
        canManageIntegrations: true,
        moreTeamsToJoin: true,
        guestAccessEnabled: true,
        teamIsGroupConstrained: true,
        actions: {
            openModal: jest.fn(),
            showMentions: jest.fn(),
            showFlaggedPosts: jest.fn(),
            closeRightHandSide: jest.fn(),
            closeRhsMenu: jest.fn(),
        },
        isCloud: false,
        isStarterFree: false,
        canInviteTeamMember: false,
        isFreeTrial: false,
        usageDeltaTeams: -1,
        mobile: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render correctly in web view', () => {
        const {container} = renderWithContext(
            <MainMenu
                {...requiredProps}
            />,
        );

        expect(screen.getByText('some plugin text')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should render correctly in mobile view with some plugin and ability to click plugin', () => {
        const props = {
            ...requiredProps,
            mobile: true,
        };

        const {container} = renderWithContext(
            <MainMenu
                {...props}
            />,
        );

        expect(screen.getByText('some plugin text')).toBeInTheDocument();
        expect(container).toMatchSnapshot();

        userEvent.click(screen.getByText('some plugin text'));
        expect(pluginAction).toHaveBeenCalled();
    });
});

