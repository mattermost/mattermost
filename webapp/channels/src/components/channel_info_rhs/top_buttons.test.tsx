// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import TopButtons from './top_buttons';
import type {Props} from './top_buttons';

const mockOnCopyTextClick = jest.fn();
jest.mock('../common/hooks/useCopyText', () => {
    return jest.fn(() => {
        return {
            copiedRecently: false,
            copyError: '',
            onClick: mockOnCopyTextClick,
        };
    });
});

describe('channel_info_rhs/top_buttons', () => {
    const topButtonDefaultProps: Props = {
        channelType: Constants.OPEN_CHANNEL,
        channelURL: 'https://test.com',
        isFavorite: false,
        isMuted: false,
        isInvitingPeople: false,
        isInManagedCategory: false,
        canAddPeople: true,
        actions: {
            addPeople: jest.fn(),
            toggleFavorite: jest.fn(),
            toggleMute: jest.fn(),
        },
    };

    test('should display and toggle Favorite', async () => {
        const toggleFavorite = jest.fn();

        // Favorite to Favorited
        const testProps: Props = {
            ...topButtonDefaultProps,
            actions: {
                ...topButtonDefaultProps.actions,
                toggleFavorite,
            },
        };

        await renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Favorite')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Favorite'));
        expect(toggleFavorite).toHaveBeenCalled();

        // Favorited to Favorite
        toggleFavorite.mockReset();
        testProps.isFavorite = true;
        await renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Favorited')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Favorited'));
        expect(toggleFavorite).toHaveBeenCalled();
    });

    test('should display and toggle Mute', async () => {
        const toggleMute = jest.fn();

        // Mute to Muted
        const testProps: Props = {
            ...topButtonDefaultProps,
            actions: {
                ...topButtonDefaultProps.actions,
                toggleMute,
            },
        };

        await renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Mute')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Mute'));
        expect(toggleMute).toHaveBeenCalled();

        // Muted to Mute
        toggleMute.mockReset();
        testProps.isMuted = true;
        await renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Muted')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Muted'));
        expect(toggleMute).toHaveBeenCalled();
    });

    test('should display and active call Add People', async () => {
        const addPeople = jest.fn();

        const testProps = {
            ...topButtonDefaultProps,
            actions: {
                ...topButtonDefaultProps.actions,
                addPeople,
            },
        };

        await renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Add People')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Add People'));
        expect(addPeople).toHaveBeenCalled();
    });
    test('should not Add People in DM', async () => {
        const testProps: Props = {
            ...topButtonDefaultProps,
            channelType: Constants.DM_CHANNEL,
        };

        await renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.queryByText('Add People')).not.toBeInTheDocument();
    });

    test('should not Add People without permission', async () => {
        const testProps: Props = {
            ...topButtonDefaultProps,
            canAddPeople: false,
        };

        await renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.queryByText('Add People')).not.toBeInTheDocument();
    });

    test('can copy link', async () => {
        await renderWithContext(
            <TopButtons
                {...topButtonDefaultProps}
            />,
        );

        expect(screen.getByText('Copy Link')).toBeInTheDocument();
        await userEvent.click(screen.getByText('Copy Link'));
        expect(mockOnCopyTextClick).toHaveBeenCalled();
    });

    test('should disable favorite button when channel is in a managed category', async () => {
        const toggleFavorite = jest.fn();
        const testProps: Props = {
            ...topButtonDefaultProps,
            isInManagedCategory: true,
            actions: {
                ...topButtonDefaultProps.actions,
                toggleFavorite,
            },
        };

        await renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        const favoriteButton = screen.getByRole('button', {name: 'Favorite'});
        expect(favoriteButton).toBeDisabled();
    });

    test('cannot copy link in DM or GM', async () => {
        for (const channelType of [Constants.GM_CHANNEL, Constants.DM_CHANNEL]) {
            const localProps: Props = {
                ...topButtonDefaultProps,
                channelType,
            };

            await renderWithContext(
                <TopButtons
                    {...localProps}
                />,
            );

            expect(screen.queryByText('Copy Link')).not.toBeInTheDocument();
        }
    });
});
