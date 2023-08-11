// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithIntl, screen} from 'tests/react_testing_utils';
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
        canAddPeople: true,
        actions: {
            addPeople: jest.fn(),
            toggleFavorite: jest.fn(),
            toggleMute: jest.fn(),
        },
    };

    test('should display and toggle Favorite', () => {
        const toggleFavorite = jest.fn();

        // Favorite to Favorited
        const testProps: Props = {
            ...topButtonDefaultProps,
            actions: {
                ...topButtonDefaultProps.actions,
                toggleFavorite,
            },
        };

        renderWithIntl(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Favorite')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Favorite'));
        expect(toggleFavorite).toHaveBeenCalled();

        // Favorited to Favorite
        toggleFavorite.mockReset();
        testProps.isFavorite = true;
        renderWithIntl(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Favorited')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Favorited'));
        expect(toggleFavorite).toHaveBeenCalled();
    });

    test('should display and toggle Mute', () => {
        const toggleMute = jest.fn();

        // Mute to Muted
        const testProps: Props = {
            ...topButtonDefaultProps,
            actions: {
                ...topButtonDefaultProps.actions,
                toggleMute,
            },
        };

        renderWithIntl(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Mute')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Mute'));
        expect(toggleMute).toHaveBeenCalled();

        // Muted to Mute
        toggleMute.mockReset();
        testProps.isMuted = true;
        renderWithIntl(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Muted')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Muted'));
        expect(toggleMute).toHaveBeenCalled();
    });

    test('should display and active call Add People', () => {
        const addPeople = jest.fn();

        const testProps = {
            ...topButtonDefaultProps,
            actions: {
                ...topButtonDefaultProps.actions,
                addPeople,
            },
        };

        renderWithIntl(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Add People')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Add People'));
        expect(addPeople).toHaveBeenCalled();
    });
    test('should not Add People in DM', () => {
        const testProps: Props = {
            ...topButtonDefaultProps,
            channelType: Constants.DM_CHANNEL,
        };

        renderWithIntl(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.queryByText('Add People')).not.toBeInTheDocument();
    });

    test('should not Add People without permission', () => {
        const testProps: Props = {
            ...topButtonDefaultProps,
            canAddPeople: false,
        };

        renderWithIntl(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.queryByText('Add People')).not.toBeInTheDocument();
    });

    test('can copy link', () => {
        renderWithIntl(
            <TopButtons
                {...topButtonDefaultProps}
            />,
        );

        expect(screen.getByText('Copy Link')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Copy Link'));
        expect(mockOnCopyTextClick).toHaveBeenCalled();
    });

    test('cannot copy link in DM or GM', () => {
        [
            Constants.GM_CHANNEL,
            Constants.DM_CHANNEL,
        ].forEach((channelType) => {
            const localProps: Props = {
                ...topButtonDefaultProps,
                channelType,
            };
            renderWithIntl(
                <TopButtons
                    {...localProps}
                />,
            );

            expect(screen.queryByText('Copy Link')).not.toBeInTheDocument();
        });
    });
});
