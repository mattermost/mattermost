// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';

import TopButtons from './top_buttons';
import type {Props} from './top_buttons';

const mockOnCopyTextClick = vi.fn();
vi.mock('../common/hooks/useCopyText', () => ({
    __esModule: true,
    default: () => {
        return {
            copiedRecently: false,
            copyError: '',
            onClick: mockOnCopyTextClick,
        };
    },
}));

describe('channel_info_rhs/top_buttons', () => {
    const topButtonDefaultProps: Props = {
        channelType: Constants.OPEN_CHANNEL,
        channelURL: 'https://test.com',
        isFavorite: false,
        isMuted: false,
        isInvitingPeople: false,
        canAddPeople: true,
        actions: {
            addPeople: vi.fn(),
            toggleFavorite: vi.fn(),
            toggleMute: vi.fn(),
        },
    };

    test('should display and toggle Favorite', () => {
        const toggleFavorite = vi.fn();

        // Favorite to Favorited
        const testProps: Props = {
            ...topButtonDefaultProps,
            actions: {
                ...topButtonDefaultProps.actions,
                toggleFavorite,
            },
        };

        renderWithContext(
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
        renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Favorited')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Favorited'));
        expect(toggleFavorite).toHaveBeenCalled();
    });

    test('should display and toggle Mute', () => {
        const toggleMute = vi.fn();

        // Mute to Muted
        const testProps: Props = {
            ...topButtonDefaultProps,
            actions: {
                ...topButtonDefaultProps.actions,
                toggleMute,
            },
        };

        renderWithContext(
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
        renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.getByText('Muted')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Muted'));
        expect(toggleMute).toHaveBeenCalled();
    });

    test('should display and active call Add People', () => {
        const addPeople = vi.fn();

        const testProps = {
            ...topButtonDefaultProps,
            actions: {
                ...topButtonDefaultProps.actions,
                addPeople,
            },
        };

        renderWithContext(
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

        renderWithContext(
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

        renderWithContext(
            <TopButtons
                {...testProps}
            />,
        );

        expect(screen.queryByText('Add People')).not.toBeInTheDocument();
    });

    test('can copy link', () => {
        renderWithContext(
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
            renderWithContext(
                <TopButtons
                    {...localProps}
                />,
            );

            expect(screen.queryByText('Copy Link')).not.toBeInTheDocument();
        });
    });
});
