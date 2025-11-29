// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelList from './channel_list';

describe('admin_console/team_channel_settings/channel/ChannelList', () => {
    const channel: Channel = Object.assign(TestHelper.getChannelMock({id: 'channel-1'}));

    test('should match snapshot', async () => {
        const testChannels = [{
            ...channel,
            id: '123',
            display_name: 'DN',
            team_display_name: 'teamDisplayName',
            team_name: 'teamName',
            team_update_at: 1,
        }];

        const actions = {
            getData: vi.fn().mockResolvedValue(testChannels),
            searchAllChannels: vi.fn().mockResolvedValue(testChannels),
        };

        const {container} = renderWithContext(
            <ChannelList
                data={testChannels}
                total={testChannels.length}
                actions={actions}
            />,
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('DN')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with shared channel', async () => {
        const testChannels = [{
            ...channel,
            shared: true,
            id: '123',
            display_name: 'DN',
            team_display_name: 'teamDisplayName',
            team_name: 'teamName',
            team_update_at: 1,
        }];

        const actions = {
            getData: vi.fn().mockResolvedValue(testChannels),
            searchAllChannels: vi.fn().mockResolvedValue(testChannels),
        };

        const {container} = renderWithContext(
            <ChannelList
                data={testChannels}
                total={testChannels.length}
                actions={actions}
            />,
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('DN')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with paging', async () => {
        const testChannels = [];
        for (let i = 0; i < 30; i++) {
            testChannels.push({
                ...channel,
                id: 'id' + i,
                display_name: 'DN' + i,
                team_display_name: 'teamDisplayName',
                team_name: 'teamName',
                team_update_at: 1,
            });
        }
        const actions = {
            getData: vi.fn().mockResolvedValue(Promise.resolve(testChannels)),
            searchAllChannels: vi.fn().mockResolvedValue(Promise.resolve(testChannels)),
        };

        const {container} = renderWithContext(
            <ChannelList
                data={testChannels}
                total={30}
                actions={actions}
            />,
        );

        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('DN0')).toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });
});
