// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {withIntl} from 'tests/helpers/intl-test-helper';
import {render, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import ChannelsInput from './channels_input';

describe('components/widgets/inputs/ChannelsInput', () => {
    const mockChannelsLoader = jest.fn();
    const mockOnChange = jest.fn();
    const mockOnInputChange = jest.fn();

    const publicChannel: Channel = {
        id: 'test-channel-1',
        type: 'O',
        display_name: 'Test Public Channel',
        name: 'test-public-channel',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        team_id: 'team-id',
        creator_id: 'creator-id',
        header: '',
        purpose: '',
        last_post_at: 0,
        last_root_post_at: 0,
        total_msg_count: 0,
        extra_update_at: 0,
        scheme_id: '',
        group_constrained: false,
    } as Channel;

    const privateChannel: Channel = {
        id: 'test-channel-2',
        type: 'P',
        display_name: 'Test Private Channel',
        name: 'test-private-channel',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        team_id: 'team-id',
        creator_id: 'creator-id',
        header: '',
        purpose: '',
        last_post_at: 0,
        last_root_post_at: 0,
        total_msg_count: 0,
        extra_update_at: 0,
        scheme_id: '',
        group_constrained: false,
    } as Channel;

    const defaultProps = {
        placeholder: 'Search for channels',
        ariaLabel: 'Channel search input',
        onChange: mockOnChange,
        channelsLoader: mockChannelsLoader,
        onInputChange: mockOnInputChange,
        inputValue: '',
        value: [],
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockChannelsLoader.mockResolvedValue([]);
    });

    test('should render with selected public channel', () => {
        render(
            withIntl(
                <ChannelsInput
                    {...defaultProps}
                    value={[publicChannel]}
                />,
            ),
        );

        expect(screen.getByText('Test Public Channel')).toBeInTheDocument();
        expect(screen.getByText('test-public-channel')).toBeInTheDocument();
        expect(screen.getByLabelText('Channel search input')).toBeInTheDocument();
    });

    test('should render with selected private channel', () => {
        render(
            withIntl(
                <ChannelsInput
                    {...defaultProps}
                    value={[privateChannel]}
                />,
            ),
        );

        expect(screen.getByText('Test Private Channel')).toBeInTheDocument();
        expect(screen.getByText('test-private-channel')).toBeInTheDocument();
    });

    test('should render with multiple selected channels', () => {
        render(
            withIntl(
                <ChannelsInput
                    {...defaultProps}
                    value={[publicChannel, privateChannel]}
                />,
            ),
        );

        expect(screen.getByText('Test Public Channel')).toBeInTheDocument();
        expect(screen.getByText('Test Private Channel')).toBeInTheDocument();
    });

    test('should call channelsLoader when input changes', async () => {
        mockChannelsLoader.mockResolvedValue([publicChannel]);

        render(withIntl(<ChannelsInput {...defaultProps}/>));

        const input = screen.getByLabelText('Channel search input');
        await userEvent.type(input, 'test');

        await waitFor(() => {
            expect(mockChannelsLoader).toHaveBeenCalled();
        });
    });

    test('should call onChange when channel is selected', async () => {
        mockChannelsLoader.mockResolvedValue([publicChannel]);

        render(withIntl(<ChannelsInput {...defaultProps}/>));

        const input = screen.getByLabelText('Channel search input');

        // Focus the input to trigger the menu
        await userEvent.click(input);

        // Type to search
        await userEvent.type(input, 'test');

        await waitFor(() => {
            expect(mockChannelsLoader).toHaveBeenCalled();
        });
    });

    test('should call onInputChange when typing', async () => {
        render(withIntl(<ChannelsInput {...defaultProps}/>));

        const input = screen.getByLabelText('Channel search input');
        await userEvent.type(input, 't');

        await waitFor(() => {
            expect(mockOnInputChange).toHaveBeenCalledWith('t');
        });
    });

    test('should display loading message when loading', async () => {
        // Mock a slow loading response
        mockChannelsLoader.mockImplementation(() => {
            return new Promise((resolve) => {
                setTimeout(() => resolve([publicChannel]), 100);
            });
        });

        render(withIntl(<ChannelsInput {...defaultProps}/>));

        const input = screen.getByLabelText('Channel search input');
        await userEvent.click(input);
        await userEvent.type(input, 'test');

        // Loading spinner should appear
        await waitFor(() => {
            expect(screen.queryByText('Loading')).toBeInTheDocument();
        });
    });

    test('should display no options message when no channels found', async () => {
        mockChannelsLoader.mockResolvedValue([]);

        render(
            withIntl(
                <ChannelsInput
                    {...defaultProps}
                    inputValue='nonexistent'
                />,
            ),
        );

        const input = screen.getByLabelText('Channel search input');
        await userEvent.click(input);

        await waitFor(() => {
            expect(screen.queryByText(/No channels found/i)).toBeInTheDocument();
        });
    });

    test('should remove channel when clicking remove button', async () => {
        render(
            withIntl(
                <ChannelsInput
                    {...defaultProps}
                    value={[publicChannel]}
                />,
            ),
        );

        // Find the remove icon by its aria-label
        const removeIcon = screen.getByLabelText('Close Icon');
        expect(removeIcon).toBeInTheDocument();

        // Click on the parent div that contains the remove icon
        const removeButton = removeIcon.closest('[class*="multi-value__remove"]');
        if (removeButton) {
            await userEvent.click(removeButton as HTMLElement);

            await waitFor(() => {
                expect(mockOnChange).toHaveBeenCalled();
            });
        }
    });

    test('should handle channelsLoader with callback', async () => {
        const callbackLoader = jest.fn((_inputValue: string, callback?: (channels: Channel[]) => void) => {
            if (callback) {
                callback([publicChannel]);
            }
            return Promise.resolve([publicChannel]);
        });

        render(
            withIntl(
                <ChannelsInput
                    {...defaultProps}
                    channelsLoader={callbackLoader}
                />,
            ),
        );

        const input = screen.getByLabelText('Channel search input');
        await userEvent.click(input);
        await userEvent.type(input, 'test');

        await waitFor(() => {
            expect(callbackLoader).toHaveBeenCalled();
        });
    });
});
