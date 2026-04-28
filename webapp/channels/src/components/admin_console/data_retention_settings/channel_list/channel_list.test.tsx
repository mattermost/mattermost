// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import ChannelList from 'components/admin_console/data_retention_settings/channel_list/channel_list';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/admin_console/data_retention_settings/channel_list', () => {
    const channel: Channel = Object.assign(TestHelper.getChannelMock({id: 'channel-1'}));

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        (console.error as jest.Mock).mockClear();
    });

    test('should match snapshot', () => {
        const testChannels = [{
            ...channel,
            id: '123',
            display_name: 'DN',
            team_display_name: 'teamDisplayName',
            team_name: 'teamName',
            team_update_at: 1,
        }];
        const actions = {
            getDataRetentionCustomPolicyChannels: jest.fn().mockResolvedValue(testChannels),
            searchChannels: jest.fn(),
            setChannelListSearch: jest.fn(),
            setChannelListFilters: jest.fn(),
        };
        const {container} = renderWithContext(
            <ChannelList
                searchTerm=''
                filters={{}}
                onRemoveCallback={jest.fn()}
                channelsToRemove={{}}
                channelsToAdd={{}}
                channels={testChannels}
                totalCount={testChannels.length}
                actions={actions}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with paging', () => {
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
            getDataRetentionCustomPolicyChannels: jest.fn().mockResolvedValue(testChannels),
            searchChannels: jest.fn(),
            setChannelListSearch: jest.fn(),
            setChannelListFilters: jest.fn(),
        };

        const {container} = renderWithContext(
            <ChannelList
                searchTerm=''
                filters={{}}
                onRemoveCallback={jest.fn()}
                channelsToRemove={{}}
                channelsToAdd={{}}
                channels={testChannels}
                totalCount={30}
                actions={actions}
            />,
        );

        // With 30 channels and page size 10, should show first 10 and pagination
        expect(screen.getByText('DN0')).toBeInTheDocument();
        expect(screen.getByText('DN9')).toBeInTheDocument();
        expect(screen.getByText((content) => content.includes('1') && content.includes('10') && content.includes('30'))).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
