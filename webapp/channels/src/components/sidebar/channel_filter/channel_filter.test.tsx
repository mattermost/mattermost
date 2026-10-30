// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ChannelFilterIntl from 'components/sidebar/channel_filter/channel_filter';

import {renderWithContext, fireEvent, screen, userEvent} from 'tests/react_testing_utils';

describe('components/sidebar/channel_filter', () => {
    const baseProps = {
        unreadFilterEnabled: false,
        hasMultipleTeams: false,
        actions: {
            setUnreadFilterEnabled: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <ChannelFilterIntl {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if the unread filter is enabled', () => {
        const props = {
            ...baseProps,
            unreadFilterEnabled: true,
        };

        const {container} = renderWithContext(
            <ChannelFilterIntl {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should enable the unread filter on toggle when it is disabled', () => {
        const {container} = renderWithContext(
            <ChannelFilterIntl {...baseProps}/>,
        );
        const filterButton = container.querySelector('.SidebarFilters_filterButton')!;
        fireEvent.click(filterButton);

        expect(baseProps.actions.setUnreadFilterEnabled).toHaveBeenCalledWith(true);
    });

    test('should disable the unread filter on toggle when it is enabled', () => {
        const props = {
            ...baseProps,
            unreadFilterEnabled: true,
        };

        const {container} = renderWithContext(
            <ChannelFilterIntl {...props}/>,
        );
        const filterButton = container.querySelector('.SidebarFilters_filterButton')!;
        fireEvent.click(filterButton);

        expect(baseProps.actions.setUnreadFilterEnabled).toHaveBeenCalledWith(false);
    });

    describe('as the product rail\'s filter menu', () => {
        const railProps = {
            ...baseProps,
            productRailSection: 'channels' as const,
            boardsShownInChannels: false,
            actions: {
                setUnreadFilterEnabled: jest.fn(),
                setBoardsShownInChannels: jest.fn(),
            },
        };

        test('should open a menu with the unread filter and, in Channels, showing boards', async () => {
            renderWithContext(<ChannelFilterIntl {...railProps}/>);

            await userEvent.click(screen.getByRole('button', {name: 'Filter channels'}));

            expect(screen.getByRole('menuitemcheckbox', {name: 'Unreads only'})).toHaveAttribute('aria-checked', 'false');
            expect(screen.getByRole('menuitemcheckbox', {name: 'Show boards'})).toHaveAttribute('aria-checked', 'false');
        });

        test('should toggle the unread filter and showing boards from the menu', async () => {
            renderWithContext(<ChannelFilterIntl {...railProps}/>);

            await userEvent.click(screen.getByRole('button', {name: 'Filter channels'}));
            await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Unreads only'}));
            await userEvent.click(screen.getByRole('menuitemcheckbox', {name: 'Show boards'}));

            expect(railProps.actions.setUnreadFilterEnabled).toHaveBeenCalledWith(true);
            expect(railProps.actions.setBoardsShownInChannels).toHaveBeenCalledWith(true);
        });

        test('should be the one-click unread toggle in Boards', () => {
            const props = {...railProps, productRailSection: 'boards' as const};
            renderWithContext(<ChannelFilterIntl {...props}/>);

            expect(screen.queryByRole('button', {name: 'Filter channels'})).not.toBeInTheDocument();
            fireEvent.click(screen.getByTestId('sidebar-unread-filter-button'));

            expect(props.actions.setUnreadFilterEnabled).toHaveBeenCalledWith(true);
        });
    });
});
