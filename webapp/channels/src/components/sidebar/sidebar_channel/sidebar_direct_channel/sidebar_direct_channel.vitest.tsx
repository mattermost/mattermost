// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect, vi, afterEach} from 'vitest';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarDirectChannel from 'components/sidebar/sidebar_channel/sidebar_direct_channel/sidebar_direct_channel';

import {renderWithContext, cleanup} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/sidebar/sidebar_channel/sidebar_direct_channel', () => {
    afterEach(() => {
        cleanup();
    });

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
            savePreferences: vi.fn(),
            leaveDirectChannel: vi.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <SidebarDirectChannel {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if DM is with current user', () => {
        const props = {
            ...baseProps,
            currentUserId: baseProps.teammate.id,
        };

        const {container} = renderWithContext(
            <SidebarDirectChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if DM is with deleted user', () => {
        const props = {
            ...baseProps,
            teammate: {
                ...baseProps.teammate,
                delete_at: 1234,
            },
        };

        const {container} = renderWithContext(
            <SidebarDirectChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if DM is with bot with custom icon', () => {
        const props = {
            ...baseProps,
            teammate: {
                ...baseProps.teammate,
                is_bot: true,
            },
        };

        const {container} = renderWithContext(
            <SidebarDirectChannel {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
