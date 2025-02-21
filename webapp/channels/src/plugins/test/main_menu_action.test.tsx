// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import MainMenu from 'components/main_menu/main_menu';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

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
            mobileIcon: <i className='fa fa-anchor'/>,
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

