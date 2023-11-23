// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarDirectChannel from 'components/sidebar/sidebar_channel/sidebar_direct_channel/sidebar_direct_channel';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

describe('components/sidebar/sidebar_channel/sidebar_direct_channel', () => {
    const baseProps = {
        channel: {
            id: 'channel_id',
            display_name: 'channel_display_name',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            team_id: '',
            type: 'O' as ChannelType,
            name: '',
            header: '',
            purpose: '',
            last_post_at: 0,
            last_root_post_at: 0,
            creator_id: '',
            scheme_id: '',
            group_constrained: false,
        },
        teammate: TestHelper.getUserMock(),
        currentTeamName: 'team_name',
        currentUserId: 'current_user_id',
        redirectChannel: 'redirect-channel',
        active: false,
        isMobile: false,
        actions: {
            savePreferences: jest.fn(),
            leaveDirectChannel: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallowWithIntl(
            <SidebarDirectChannel {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if DM is with current user', () => {
        const props = {
            ...baseProps,
            currentUserId: baseProps.teammate.id,
        };

        const wrapper = shallowWithIntl(
            <SidebarDirectChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if DM is with deleted user', () => {
        const props = {
            ...baseProps,
            teammate: {
                ...baseProps.teammate,
                delete_at: 1234,
            },
        };

        const wrapper = shallowWithIntl(
            <SidebarDirectChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot if DM is with bot with custom icon', () => {
        const props = {
            ...baseProps,
            teammate: {
                ...baseProps.teammate,
                is_bot: true,
            },
        };

        const wrapper = shallowWithIntl(
            <SidebarDirectChannel {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
