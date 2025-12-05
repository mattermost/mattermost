// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import ChannelSelectorModal from 'components/channel_selector_modal/channel_selector_modal';

import {act, renderWithContext, cleanup} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

// Use fake timers to control requestAnimationFrame and prevent focus errors after unmount
vi.useFakeTimers();

describe('components/ChannelSelectorModal', () => {
    afterEach(() => {
        // Clean up component before any pending timers fire
        cleanup();

        // Clear any pending timers to prevent focus errors
        vi.clearAllTimers();
    });

    const channel1: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({id: 'channel-1', team_id: 'teamid1'}));
    const channel2: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({id: 'channel-2', team_id: 'teamid2'}));
    const channel3: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({id: 'channel-3', team_id: 'teamid1'}));

    const defaultProps = {
        excludeNames: [],
        currentSchemeId: 'xxx',
        alreadySelected: ['channel-1'],
        searchTerm: '',
        onModalDismissed: vi.fn(),
        onChannelsSelected: vi.fn(),
        groupID: '',
        actions: {
            loadChannels: vi.fn().mockResolvedValue({data: [
                channel1,
                channel2,
                channel3,
            ]}),
            setModalSearchTerm: vi.fn(),
            searchChannels: vi.fn(() => Promise.resolve({data: []})),
            searchAllChannels: vi.fn(() => Promise.resolve({data: []})),
        },
    };

    test('should match snapshot', async () => {
        const {baseElement} = renderWithContext(<ChannelSelectorModal {...defaultProps}/>);

        // Flush pending state updates from async operations
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(baseElement).toMatchSnapshot();
    });

    test('exclude already selected', async () => {
        const {baseElement} = renderWithContext(
            <ChannelSelectorModal
                {...defaultProps}
                excludeTeamIds={['teamid2']}
            />,
        );

        // Flush pending state updates from async operations
        await act(async () => {
            await vi.runAllTimersAsync();
        });

        expect(baseElement).toMatchSnapshot();
    });
});
