// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import ChannelList from 'components/admin_console/data_retention_settings/channel_list/channel_list';

import {renderWithContext} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/admin_console/data_retention_settings/channel_list', () => {
    const channel: Channel = Object.assign(TestHelper.getChannelMock({id: 'channel-1'}));

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
            getDataRetentionCustomPolicyChannels: vi.fn().mockResolvedValue(testChannels),
            searchChannels: vi.fn(),
            setChannelListSearch: vi.fn(),
            setChannelListFilters: vi.fn(),
        };
        const {container} = renderWithContext(
            <ChannelList
                searchTerm=''
                filters={{}}
                onRemoveCallback={vi.fn()}
                onAddCallback={vi.fn()}
                channelsToRemove={{}}
                channelsToAdd={{}}
                channels={testChannels}
                totalCount={testChannels.length}
                actions={actions}
            />);
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
            getDataRetentionCustomPolicyChannels: vi.fn().mockResolvedValue(testChannels),
            searchChannels: vi.fn(),
            setChannelListSearch: vi.fn(),
            setChannelListFilters: vi.fn(),
        };

        const {container} = renderWithContext(
            <ChannelList
                searchTerm=''
                filters={{}}
                onRemoveCallback={vi.fn()}
                onAddCallback={vi.fn()}
                channelsToRemove={{}}
                channelsToAdd={{}}
                channels={testChannels}
                totalCount={30}
                actions={actions}
            />);
        expect(container).toMatchSnapshot();
    });
});
