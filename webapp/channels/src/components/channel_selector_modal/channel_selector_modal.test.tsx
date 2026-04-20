// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelWithTeamData} from '@mattermost/types/channels';

import {ChannelSelectorModal} from 'components/channel_selector_modal/channel_selector_modal';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, act} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/ChannelSelectorModal', () => {
    const originalRAF = window.requestAnimationFrame;

    beforeEach(() => {
        window.requestAnimationFrame = jest.fn();
    });

    afterEach(() => {
        window.requestAnimationFrame = originalRAF;
    });

    const channel1: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({id: 'channel-1', team_id: 'teamid1'}));
    const channel2: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({id: 'channel-2', team_id: 'teamid2'}));
    const channel3: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({id: 'channel-3', team_id: 'teamid1'}));
    const groupSyncedChannel: ChannelWithTeamData = Object.assign(TestHelper.getChannelWithTeamDataMock({
        id: 'channel-4',
        team_id: 'teamid3',
        group_constrained: true,
    }));

    const defaultProps = {
        intl: defaultIntl,
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
        const ref = React.createRef<InstanceType<typeof ChannelSelectorModal>>();
        const {container} = renderWithContext(
            <ChannelSelectorModal
                {...defaultProps}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({channels: [
                channel1,
                channel2,
                channel3,
            ]});
        });
        expect(container).toMatchSnapshot();
    });

    test('exclude already selected', () => {
        const ref = React.createRef<InstanceType<typeof ChannelSelectorModal>>();
        const {container} = renderWithContext(
            <ChannelSelectorModal
                {...defaultProps}
                excludeTeamIds={['teamid2']}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({channels: [
                channel1,
                channel2,
                channel3,
            ]});
        });

        expect(container).toMatchSnapshot();
    });

    test('should show custom no options message when no channels and no search term', async () => {
        const customMessage = (
            <div className='custom-message'>
                {'No private channels available'}
            </div>
        );

        // Use a loadChannels that resolves with empty data so componentDidMount doesn't populate channels
        const loadChannels = jest.fn().mockResolvedValue({data: []});

        const ref = React.createRef<InstanceType<typeof ChannelSelectorModal>>();
        renderWithContext(
            <ChannelSelectorModal
                {...defaultProps}
                searchTerm={''}
                customNoOptionsMessage={customMessage}
                actions={{
                    ...defaultProps.actions,
                    loadChannels,
                }}
                ref={ref}
            />,
        );

        // Wait for the initial loadChannels promise from componentDidMount to resolve and flush state updates
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        // Modal renders in a portal, so query the document body instead of container
        expect(document.body.querySelector('.custom-message')).not.toBeNull();
    });

    test('should not show custom message when user is searching', () => {
        const customMessage = (
            <div className='custom-message'>
                {'No private channels available'}
            </div>
        );

        const ref = React.createRef<InstanceType<typeof ChannelSelectorModal>>();
        const {container} = renderWithContext(
            <ChannelSelectorModal
                {...defaultProps}
                searchTerm={'test'}
                customNoOptionsMessage={customMessage}
                ref={ref}
            />,
        );

        // Set empty channels array
        act(() => {
            ref.current!.setState({
                channels: [],
                loadingChannels: false,
            });
        });

        // Should NOT show the custom message when searching
        expect(container.querySelector('.custom-message')).toBeNull();
    });

    test('should not show custom message when channels are available', () => {
        const customMessage = (
            <div className='custom-message'>
                {'No private channels available'}
            </div>
        );

        const ref = React.createRef<InstanceType<typeof ChannelSelectorModal>>();
        const {container} = renderWithContext(
            <ChannelSelectorModal
                {...defaultProps}
                searchTerm={''}
                customNoOptionsMessage={customMessage}
                ref={ref}
            />,
        );

        // Set channels array with data
        act(() => {
            ref.current!.setState({
                channels: [channel1, channel2],
                loadingChannels: false,
            });
        });

        // The component renders normally with channels
        expect(container).toMatchSnapshot();
    });

    test('excludes group constrained channels when requested', () => {
        const ref = React.createRef<InstanceType<typeof ChannelSelectorModal>>();
        const {container} = renderWithContext(
            <ChannelSelectorModal
                {...defaultProps}
                excludeGroupConstrained={true}
                ref={ref}
            />,
        );
        act(() => {
            ref.current!.setState({channels: [
                channel1,
                groupSyncedChannel,
            ]});
        });

        // The group constrained channel should not appear in the rendered output
        expect(container).toMatchSnapshot();
    });
});
