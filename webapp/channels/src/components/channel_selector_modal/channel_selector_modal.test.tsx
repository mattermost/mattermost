// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import ChannelSelectorModal from 'components/channel_selector_modal/channel_selector_modal';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

describe('components/ChannelSelectorModal', () => {
    const channel1: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({id: 'channel-1', team_id: 'teamid1'}));
    const channel2: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({id: 'channel-2', team_id: 'teamid2'}));
    const channel3: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({id: 'channel-3', team_id: 'teamid1'}));

    const defaultProps = {
        excludeNames: [],
        currentSchemeId: 'xxx',
        alreadySelected: ['channel-1'],
        searchTerm: '',
        onModalDismissed: jest.fn(),
        onChannelsSelected: jest.fn(),
        groupID: '',
        actions: {
            loadChannels: jest.fn().mockResolvedValue({data: [
                channel1,
                channel2,
                channel3,
            ]}),
            setModalSearchTerm: jest.fn(),
            searchChannels: jest.fn(() => Promise.resolve({data: []})),
            searchAllChannels: jest.fn(() => Promise.resolve({data: []})),
        },
    };

    test('should match snapshot', () => {
        const wrapper = shallowWithIntl(<ChannelSelectorModal {...defaultProps}/>);
        wrapper.setState({channels: [
            channel1,
            channel2,
            channel3,
        ]});
        expect(wrapper).toMatchSnapshot();
    });

    test('exclude already selected', () => {
        const wrapper = shallowWithIntl(
            <ChannelSelectorModal
                {...defaultProps}
                excludeTeamIds={['teamid2']}
            />,
        );
        wrapper.setState({channels: [
            channel1,
            channel2,
            channel3,
        ]});

        expect(wrapper).toMatchSnapshot();
    });
});
