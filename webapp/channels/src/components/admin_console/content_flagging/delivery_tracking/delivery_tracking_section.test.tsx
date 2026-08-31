// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeliveryTrackingConfig} from '@mattermost/types/delivery_tracking';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import DeliveryTrackingSection from './delivery_tracking_section';

jest.mock('./channel_multiselector', () => ({
    __esModule: true,
    default: ({id, channelIds, onChange}: {id: string; channelIds: string[]; onChange: (channelIds: string[]) => void}) => (
        <div data-testid={`channel-multi-selector-${id}`}>
            <button
                data-testid={`${id}-change-channels`}
                onClick={() => onChange(['channel1', 'channel2'])}
            >
                {'Change Channels'}
            </button>
            <span data-testid={`${id}-value`}>{channelIds.join(',')}</span>
        </div>
    ),
}));

describe('DeliveryTrackingSection', () => {
    const baseValue: DeliveryTrackingConfig = {
        Enable: false,
        EnableForAllChannels: true,
        ChannelIds: [],
    };

    const renderSection = (value: Partial<DeliveryTrackingConfig> = {}, hasError = false) => {
        const onChange = jest.fn();
        renderWithContext(
            <DeliveryTrackingSection
                value={{...baseValue, ...value}}
                onChange={onChange}
                hasError={hasError}
            />,
        );
        return onChange;
    };

    test('should render the title, description and Beta tag', () => {
        renderSection();

        expect(screen.getByText('Post Delivery Audit Logging')).toBeInTheDocument();
        expect(screen.getByText(/Record an audit log entry each time a message is delivered/)).toBeInTheDocument();
        expect(screen.getByText('BETA')).toBeInTheDocument();
    });

    test('should hide the scope radios and the picker when disabled', () => {
        renderSection({Enable: false});

        expect(screen.getByTestId('deliveryTrackingEnable_false')).toBeChecked();
        expect(screen.queryByTestId('deliveryTrackingAllChannels_true')).not.toBeInTheDocument();
        expect(screen.queryByTestId('channel-multi-selector-delivery_tracking_channels')).not.toBeInTheDocument();
    });

    test('should show the scope radios but not the picker when tracking all channels', () => {
        renderSection({Enable: true, EnableForAllChannels: true});

        expect(screen.getByTestId('deliveryTrackingAllChannels_true')).toBeChecked();
        expect(screen.queryByTestId('channel-multi-selector-delivery_tracking_channels')).not.toBeInTheDocument();
    });

    test('should show the picker when scoped to selected channels', () => {
        renderSection({Enable: true, EnableForAllChannels: false, ChannelIds: ['channel1']});

        expect(screen.getByTestId('deliveryTrackingAllChannels_false')).toBeChecked();
        expect(screen.getByTestId('channel-multi-selector-delivery_tracking_channels')).toBeInTheDocument();
        expect(screen.getByTestId('delivery_tracking_channels-value')).toHaveTextContent('channel1');
    });

    test('should emit Enable when the enable radio changes', async () => {
        const onChange = renderSection({Enable: false});

        await userEvent.click(screen.getByTestId('deliveryTrackingEnable_true'));

        expect(onChange).toHaveBeenCalledWith({...baseValue, Enable: true});
    });

    test('should emit EnableForAllChannels when the scope radio changes', async () => {
        const onChange = renderSection({Enable: true, EnableForAllChannels: true});

        await userEvent.click(screen.getByTestId('deliveryTrackingAllChannels_false'));

        expect(onChange).toHaveBeenCalledWith({...baseValue, Enable: true, EnableForAllChannels: false});
    });

    test('should emit ChannelIds when the picker changes', async () => {
        const onChange = renderSection({Enable: true, EnableForAllChannels: false, ChannelIds: ['channel1']});

        await userEvent.click(screen.getByTestId('delivery_tracking_channels-change-channels'));

        expect(onChange).toHaveBeenCalledWith({
            Enable: true,
            EnableForAllChannels: false,
            ChannelIds: ['channel1', 'channel2'],
        });
    });

    test('should show the required message instead of the help text on error', () => {
        renderSection({Enable: true, EnableForAllChannels: false, ChannelIds: []}, true);

        expect(screen.getByText('Select at least one channel, or choose All channels.')).toBeInTheDocument();
        expect(screen.queryByText(/Deliveries are recorded only in these channels/)).not.toBeInTheDocument();
    });
});
