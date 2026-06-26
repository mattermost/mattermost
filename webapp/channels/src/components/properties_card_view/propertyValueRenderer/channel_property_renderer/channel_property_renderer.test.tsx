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

        const {container} = renderWithContext(
            <ChannelPropertyRenderer
                value={mockValue}
                metadata={{channel: dmChannel}}
            />,
        );

        expect(screen.getByText('Direct Message')).toBeInTheDocument();
        expect(container.querySelector('i.icon')).toBeNull();
    });

    it('should not render icon for group message channels', () => {
        const gmChannel = {
            ...mockChannel,
            type: 'G' as const,
            display_name: 'Group Message',
        };

        const {container} = renderWithContext(
            <ChannelPropertyRenderer
                value={mockValue}
                metadata={{channel: gmChannel}}
            />,
        );

        expect(screen.getByText('Group Message')).toBeInTheDocument();
        expect(container.querySelector('i.icon')).toBeNull();
    });

    it('should render override icon when matcher matches', () => {
        const overrideState = {plugins: {components: {ChannelIconOverride: [{id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'}]}}} as any;

        const {container} = renderWithContext(
            <ChannelPropertyRenderer
                value={mockValue}
                metadata={{channel: mockChannel}}
            />,
            overrideState,
        );

        const icon = container.querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-shield-outline');
        expect(icon).not.toHaveClass('icon-globe');
    });

    it('falls back to icon-globe when no matcher matches for an open channel', () => {
        const noMatchState = {plugins: {components: {ChannelIconOverride: [{id: '1', pluginId: 'mbe', matcher: () => false, iconName: 'shield-outline'}]}}} as any;

        const {container} = renderWithContext(
            <ChannelPropertyRenderer
                value={mockValue}
                metadata={{channel: mockChannel}}
            />,
            noMatchState,
        );

        const icon = container.querySelector('i');
        expect(icon).toHaveClass('icon', 'icon-globe');
        expect(icon).not.toHaveClass('icon-shield-outline');
    });
});
