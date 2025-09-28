// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {PropertyValue} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelPropertyRenderer from './channel_property_renderer';

jest.mock('components/common/hooks/useChannel');

const mockUseChannel = require('components/common/hooks/useChannel').useChannel as jest.MockedFunction<typeof import('components/common/hooks/useChannel').useChannel>;

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should render channel name and icon when channel exists', () => {
        mockUseChannel.mockReturnValue(mockChannel);

        renderWithContext(
            <ChannelPropertyRenderer value={mockValue}/>,
        );

        expect(screen.getByTestId('channel-property')).toBeInTheDocument();
        expect(screen.getByText('Test Channel')).toBeInTheDocument();
        expect(mockUseChannel).toHaveBeenCalledWith('channel-id-123');
    });

    it('should render deleted channel message when channel does not exist', () => {
        mockUseChannel.mockReturnValue(undefined);

        renderWithContext(
            <ChannelPropertyRenderer value={mockValue}/>,
        );

        expect(screen.getByTestId('channel-property')).toBeInTheDocument();
        expect(screen.getByText(/Deleted channel ID: channel-id-123/)).toBeInTheDocument();
        expect(mockUseChannel).toHaveBeenCalledWith('channel-id-123');
    });

    it('should render deleted channel message when channel is undefined', () => {
        mockUseChannel.mockReturnValue(undefined);

        renderWithContext(
            <ChannelPropertyRenderer value={mockValue}/>,
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
        mockUseChannel.mockReturnValue(privateChannel);

        renderWithContext(
            <ChannelPropertyRenderer value={mockValue}/>,
        );

        expect(screen.getByText('Private Channel')).toBeInTheDocument();
    });

    it('should handle direct message channels', () => {
        const dmChannel = {
            ...mockChannel,
            type: 'D' as const,
            display_name: 'Direct Message',
        };
        mockUseChannel.mockReturnValue(dmChannel);

        renderWithContext(
            <ChannelPropertyRenderer value={mockValue}/>,
        );

        expect(screen.getByText('Direct Message')).toBeInTheDocument();
    });
});
