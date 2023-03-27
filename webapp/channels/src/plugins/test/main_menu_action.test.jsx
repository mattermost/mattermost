// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MainMenu from 'components/main_menu/main_menu';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

describe('plugins/MainMenuActions', () => {
    const pluginAction = jest.fn();

    const requiredProps = {
        teamId: 'someteamid',
        teamType: '',
        teamDisplayName: 'some name',
        teamName: 'somename',
        currentUser: {id: 'someuserid', roles: 'system_user'},
        enableCommands: true,
        enableCustomEmoji: true,
        enableIncomingWebhooks: true,
        enableOutgoingWebhooks: true,
        enableOAuthServiceProvider: true,
        canManageSystemBots: true,
        enableUserCreation: true,
        enableEmailInvitations: false,
        enablePluginMarketplace: true,
        showDropdown: true,
        onToggleDropdown: () => {}, //eslint-disable-line no-empty-function
        pluginMenuItems: [{id: 'someplugin', text: 'some plugin text', action: pluginAction}],
        canCreateOrDeleteCustomEmoji: true,
        canManageIntegrations: true,
        moreTeamsToJoin: true,
        guestAccessEnabled: true,
        teamIsGroupConstrained: true,
        teamUrl: '/team',
        location: {
            pathname: '/team',
        },
        actions: {
            openModal: jest.fn(),
            showMentions: jest.fn(),
            showFlaggedPosts: jest.fn(),
            closeRightHandSide: jest.fn(),
            closeRhsMenu: jest.fn(),
            getCloudLimits: jest.fn(),
        },
        isCloud: false,
        isStarterFree: false,
        subscription: {},
        userIsAdmin: true,
        isFirstAdmin: false,
        canInviteTeamMember: false,
        isFreeTrial: false,
        teamsLimitReached: false,
        usageDeltaTeams: -1,
    };

    test('should match snapshot in web view', () => {
        let wrapper = shallowWithIntl(
            <MainMenu
                {...requiredProps}
            />,
        );

        wrapper = wrapper.shallow();

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.findWhere((node) => node.key() === 'someplugin_pluginmenuitem')).toHaveLength(1);
    });

    test('should match snapshot in mobile view with some plugin and ability to click plugin', () => {
        const props = {
            ...requiredProps,
            mobile: true,
        };

        let wrapper = shallowWithIntl(
            <MainMenu
                {...props}
            />,
        );

        wrapper = wrapper.shallow();

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.findWhere((node) => node.key() === 'someplugin_pluginmenuitem')).toHaveLength(1);

        wrapper.findWhere((node) => node.key() === 'someplugin_pluginmenuitem').simulate('click');
        expect(pluginAction).toBeCalled();
    });
});

