// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {PropertyValue} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelPropertyRenderer from './channel_property_renderer';

describe('ChannelPropertyRenderer', () => {
    const mockChannel: Channel = {
        ...TestHelper.getChannelMock({
            id: 'channel-id-123',
            display_name: 'Test Channel',
            type: 'O',
        }),
    };

    const mockValue = {
        value: 'channel-id-123',
    } as PropertyValue<string>;

    it('should render channel name and icon when channel exists', () => {
        renderWithContext(
            <ChannelPropertyRenderer
                value={mockValue}
                metadata={{channel: mockChannel}}
            />,
        );

        expect(screen.getByTestId('channel-property')).toBeInTheDocument();
        expect(screen.getByText('Test Channel')).toBeInTheDocument();
    });

    it('should render deleted channel message when channel does not exist', () => {
        renderWithContext(
            <ChannelPropertyRenderer
                value={mockValue}
                metadata={{channel: undefined}}
            />,
        );

        expect(screen.getByTestId('channel-property')).toBeInTheDocument();
        expect(screen.getByText(/Deleted channel ID: channel-id-123/)).toBeInTheDocument();
    });

    it('should handle different channel types', () => {
        const privateChannel = {
            ...mockChannel,
            type: 'P' as const,
            display_name: 'Private Channel',
        };

        renderWithContext(
            <ChannelPropertyRenderer
                value={mockValue}
                metadata={{channel: privateChannel}}
            />,
        );

        expect(screen.getByText('Private Channel')).toBeInTheDocument();
    });

    it('should handle direct message channels', () => {
        const dmChannel = {
            ...mockChannel,
            type: 'D' as const,
            display_name: 'Direct Message',
        };

        renderWithContext(
            <ChannelPropertyRenderer
                value={mockValue}
                metadata={{channel: dmChannel}}
            />,
        );

        expect(screen.getByText('Direct Message')).toBeInTheDocument();
    });
});
