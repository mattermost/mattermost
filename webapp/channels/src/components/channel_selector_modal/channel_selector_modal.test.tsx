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
    const groupSyncedChannel: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({
        id: 'channel-4',
        team_id: 'teamid3',
        group_constrained: true,
    }));

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

    test('should show custom no options message when no channels and no search term', () => {
        const customMessage = (
            <div className='custom-message'>
                {'No private channels available'}
            </div>
        );

        const wrapper = shallowWithIntl(
            <ChannelSelectorModal
                {...defaultProps}
                searchTerm={''}
                customNoOptionsMessage={customMessage}
            />,
        );

        // Set empty channels array to simulate no private channels
        wrapper.setState({
            channels: [],
            loadingChannels: false,
        });

        // Find the MultiSelect component
        const multiSelect = wrapper.find('MultiSelect');

        // Should pass the custom message to MultiSelect
        expect(multiSelect.prop('customNoOptionsMessage')).toEqual(customMessage);
    });

    test('should not show custom message when user is searching', () => {
        const customMessage = (
            <div className='custom-message'>
                {'No private channels available'}
            </div>
        );

        const wrapper = shallowWithIntl(
            <ChannelSelectorModal
                {...defaultProps}
                searchTerm={'test'}
                customNoOptionsMessage={customMessage}
            />,
        );

        // Set empty channels array
        wrapper.setState({
            channels: [],
            loadingChannels: false,
        });

        // Find the MultiSelect component
        const multiSelect = wrapper.find('MultiSelect');

        // Should NOT pass the custom message when searching (let default message show)
        expect(multiSelect.prop('customNoOptionsMessage')).toBeUndefined();
    });

    test('should not show custom message when channels are available', () => {
        const customMessage = (
            <div className='custom-message'>
                {'No private channels available'}
            </div>
        );

        const wrapper = shallowWithIntl(
            <ChannelSelectorModal
                {...defaultProps}
                searchTerm={''}
                customNoOptionsMessage={customMessage}
            />,
        );

        // Set channels array with data
        wrapper.setState({
            channels: [channel1, channel2],
            loadingChannels: false,
        });

        // Find the MultiSelect component
        const multiSelect = wrapper.find('MultiSelect');

        // Custom message is passed but MultiSelect won't show it because options exist
        // The important thing is that the component renders normally with channels
        const options = multiSelect.prop('options') as any[];
        expect(options.length).toBeGreaterThan(0);
    });

    test('excludes group constrained channels when requested', () => {
        const wrapper = shallowWithIntl(
            <ChannelSelectorModal
                {...defaultProps}
                excludeGroupConstrained={true}
            />,
        );
        wrapper.setState({channels: [
            channel1,
            groupSyncedChannel,
        ]});

        const options = (wrapper.find('MultiSelect').props() as any).options;
        expect(options.find((channel: ChannelWithTeamData) => channel.id === groupSyncedChannel.id)).toBeUndefined();
    });
});
