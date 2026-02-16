// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import RecapConfiguration from './recap_configuration';

describe('RecapConfiguration', () => {
    const mockUnreadChannels: Channel[] = [
        {
            id: 'channel1',
            name: 'channel-1',
            display_name: 'Channel 1',
            type: 'O',
        } as Channel,
        {
            id: 'channel2',
            name: 'channel-2',
            display_name: 'Channel 2',
            type: 'P',
        } as Channel,
    ];

    const defaultProps = {
        recapName: '',
        setRecapName: jest.fn(),
        recapType: null as 'selected' | 'all_unreads' | null,
        setRecapType: jest.fn(),
        unreadChannels: mockUnreadChannels,
    };

    describe('Recap Name Input', () => {
        it('should render name input field', () => {
            renderWithContext(<RecapConfiguration {...defaultProps}/>);

            expect(screen.getByPlaceholderText('Give your recap a name')).toBeInTheDocument();
        });

        it('should display current recap name value', () => {
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    recapName='My Test Recap'
                />,
            );

            const input = screen.getByPlaceholderText('Give your recap a name') as HTMLInputElement;
            expect(input.value).toBe('My Test Recap');
        });

        it('should call setRecapName when name is changed', async () => {
            const setRecapName = jest.fn();
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    setRecapName={setRecapName}
                />,
            );

            const input = screen.getByPlaceholderText('Give your recap a name');
            await userEvent.type(input, 'New Recap');

            expect(setRecapName).toHaveBeenCalled();
        });

        it('should enforce maxLength of 100 characters', () => {
            renderWithContext(<RecapConfiguration {...defaultProps}/>);

            const input = screen.getByPlaceholderText('Give your recap a name') as HTMLInputElement;
            expect(input.maxLength).toBe(100);
        });
    });

    describe('Recap Type Selection', () => {
        it('should render both recap type options', () => {
            renderWithContext(<RecapConfiguration {...defaultProps}/>);

            expect(screen.getByText('Recap selected channels')).toBeInTheDocument();
            expect(screen.getByText('Recap all my unreads')).toBeInTheDocument();
        });

        it('should call setRecapType when selected channels option is clicked', async () => {
            const setRecapType = jest.fn();
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    setRecapType={setRecapType}
                />,
            );

            const selectedChannelsButton = screen.getByText('Recap selected channels').closest('button');
            await userEvent.click(selectedChannelsButton!);

            expect(setRecapType).toHaveBeenCalledWith('selected');
        });

        it('should call setRecapType when all unreads option is clicked', async () => {
            const setRecapType = jest.fn();
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    setRecapType={setRecapType}
                />,
            );

            const allUnreadsButton = screen.getByText('Recap all my unreads').closest('button');
            await userEvent.click(allUnreadsButton!);

            expect(setRecapType).toHaveBeenCalledWith('all_unreads');
        });

        it('should show selected state for selected channels option', () => {
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    recapType='selected'
                />,
            );

            const selectedButton = screen.getByText('Recap selected channels').closest('button');
            expect(selectedButton).toHaveClass('selected');
        });

        it('should show selected state for all unreads option', () => {
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    recapType='all_unreads'
                />,
            );

            const allUnreadsButton = screen.getByText('Recap all my unreads').closest('button');
            expect(allUnreadsButton).toHaveClass('selected');
        });

        it('should show check icon when selected channels is selected', () => {
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    recapType='selected'
                />,
            );

            const selectedButton = screen.getByText('Recap selected channels').closest('button');
            const checkIcon = selectedButton?.querySelector('.selected-icon');
            expect(checkIcon).toBeInTheDocument();
        });

        it('should show check icon when all unreads is selected', () => {
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    recapType='all_unreads'
                />,
            );

            const allUnreadsButton = screen.getByText('Recap all my unreads').closest('button');
            const checkIcon = allUnreadsButton?.querySelector('.selected-icon');
            expect(checkIcon).toBeInTheDocument();
        });
    });

    describe('Unread Channels Handling', () => {
        it('should disable all unreads option when no unread channels', () => {
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    unreadChannels={[]}
                />,
            );

            const allUnreadsButton = screen.getByText('Recap all my unreads').closest('button');
            expect(allUnreadsButton).toBeDisabled();
            expect(allUnreadsButton).toHaveClass('disabled');
        });

        it('should enable all unreads option when unread channels exist', () => {
            renderWithContext(<RecapConfiguration {...defaultProps}/>);

            const allUnreadsButton = screen.getByText('Recap all my unreads').closest('button');
            expect(allUnreadsButton).not.toBeDisabled();
            expect(allUnreadsButton).not.toHaveClass('disabled');
        });

        it('should not call setRecapType when all unreads is clicked with no unread channels', async () => {
            const setRecapType = jest.fn();
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    setRecapType={setRecapType}
                    unreadChannels={[]}
                />,
            );

            const allUnreadsButton = screen.getByText('Recap all my unreads').closest('button');
            await userEvent.click(allUnreadsButton!);

            expect(setRecapType).not.toHaveBeenCalled();
        });

        it('should show tooltip when all unreads option is disabled', () => {
            renderWithContext(
                <RecapConfiguration
                    {...defaultProps}
                    unreadChannels={[]}
                />,
            );

            // The WithTooltip component wraps the button when there are no unreads
            expect(screen.getByText('Recap all my unreads')).toBeInTheDocument();
        });
    });

    describe('Form Labels', () => {
        it('should display name label', () => {
            renderWithContext(<RecapConfiguration {...defaultProps}/>);

            expect(screen.getByText('Give your recap a name')).toBeInTheDocument();
        });

        it('should display type selection label', () => {
            renderWithContext(<RecapConfiguration {...defaultProps}/>);

            expect(screen.getByText('What type of recap would you like?')).toBeInTheDocument();
        });
    });

    describe('Type Descriptions', () => {
        it('should show description for selected channels option', () => {
            renderWithContext(<RecapConfiguration {...defaultProps}/>);

            expect(screen.getByText('Choose the channels you would like included in your recap')).toBeInTheDocument();
        });

        it('should show description for all unreads option', () => {
            renderWithContext(<RecapConfiguration {...defaultProps}/>);

            expect(screen.getByText('Copilot will create a recap of all unreads across your channels.')).toBeInTheDocument();
        });
    });
});

