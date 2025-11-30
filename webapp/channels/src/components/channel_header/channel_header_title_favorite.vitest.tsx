// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {favoriteChannel, unfavoriteChannel} from 'mattermost-redux/actions/channels';
import * as channelsSelectors from 'mattermost-redux/selectors/entities/channels';

import {renderWithContext, fireEvent, act, waitFor, screen} from 'tests/vitest_react_testing_utils';
import type {A11yFocusEventDetail} from 'utils/constants';
import {A11yCustomEventTypes} from 'utils/constants';

import ChannelHeaderTitleFavorite from './channel_header_title_favorite';

vi.mock('mattermost-redux/actions/channels', () => ({
    favoriteChannel: vi.fn(),
    unfavoriteChannel: vi.fn(),
}));

describe('ChannelHeaderTitleFavorite Component', () => {
    let isCurrentChannelFavoriteMock: ReturnType<typeof vi.spyOn>;
    let getCurrentChannelMock: ReturnType<typeof vi.spyOn>;
    let dispatchMock: ReturnType<typeof vi.fn>;

    const ADD_TO_FAVORITES_REGEX = /add to favorites/i;
    const REMOVE_FROM_FAVORITES_REGEX = /remove from favorites/i;
    const ADD_TO_FAVORITES_LABEL = 'add to favorites';
    const REMOVE_FROM_FAVORITES_LABEL = 'remove from favorites';

    const activeChannel: Channel = {
        id: 'channel_id',
        name: 'Active Channel',
        type: 'O',
        display_name: 'Active Channel',
        delete_at: 0,
    } as Channel;

    const archivedChannel: Channel = {
        id: 'channel_id',
        name: 'Archived Channel',
        type: 'O',
        display_name: 'Archived Channel',
        delete_at: 1,
    } as Channel;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Spy on selectors
        isCurrentChannelFavoriteMock = vi.spyOn(channelsSelectors, 'isCurrentChannelFavorite');
        getCurrentChannelMock = vi.spyOn(channelsSelectors, 'getCurrentChannel');

        // Mock useDispatch to capture dispatch calls
        dispatchMock = vi.fn();
        const reactRedux = await import('react-redux');
        vi.spyOn(reactRedux, 'useDispatch').mockReturnValue(dispatchMock as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function renderComponent() {
        return renderWithContext(<ChannelHeaderTitleFavorite/>);
    }

    it('should dispatch favoriteChannel when "Add to Favorites" button is clicked', () => {
        isCurrentChannelFavoriteMock.mockReturnValue(false);
        getCurrentChannelMock.mockReturnValue(activeChannel);

        // Mock favoriteChannel
        vi.mocked(favoriteChannel).mockImplementation(() => ({
            type: 'FAVORITE_CHANNEL',
            data: activeChannel.id,
        }) as any);

        renderComponent();

        const button = screen.getByRole('button', {name: ADD_TO_FAVORITES_REGEX});
        fireEvent.click(button);

        expect(dispatchMock).toHaveBeenCalledTimes(1);
        expect(dispatchMock).toHaveBeenCalledWith({
            type: 'FAVORITE_CHANNEL',
            data: activeChannel.id,
        });
    });

    it('should dispatch unfavoriteChannel when "Remove from Favorites" button is clicked', () => {
        isCurrentChannelFavoriteMock.mockReturnValue(true);
        getCurrentChannelMock.mockReturnValue(activeChannel);

        // Mock unfavoriteChannel
        vi.mocked(unfavoriteChannel).mockImplementation(() => ({
            type: 'UNFAVORITE_CHANNEL',
            data: activeChannel.id,
        }) as any);

        renderComponent();

        const button = screen.getByRole('button', {name: REMOVE_FROM_FAVORITES_REGEX});
        fireEvent.click(button);

        expect(dispatchMock).toHaveBeenCalledTimes(1);
        expect(dispatchMock).toHaveBeenCalledWith({
            type: 'UNFAVORITE_CHANNEL',
            data: activeChannel.id,
        });
    });

    it('should not render anything when channel is null', () => {
        isCurrentChannelFavoriteMock.mockReturnValue(false);
        getCurrentChannelMock.mockReturnValue(null);

        renderComponent();

        const button = screen.queryByRole('button', {name: ADD_TO_FAVORITES_REGEX});
        expect(button).toBeNull();
    });

    it('should not render anything when channel is archived', () => {
        isCurrentChannelFavoriteMock.mockReturnValue(false);
        getCurrentChannelMock.mockReturnValue(archivedChannel);

        renderComponent();

        const button = screen.queryByRole('button', {name: ADD_TO_FAVORITES_REGEX});
        expect(button).toBeNull();
    });

    it('should render "Add to Favorites" button when not favorite', () => {
        isCurrentChannelFavoriteMock.mockReturnValue(false);
        getCurrentChannelMock.mockReturnValue(activeChannel);

        renderComponent();

        const button = screen.getByRole('button', {name: ADD_TO_FAVORITES_REGEX});
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('inactive');
        expect(button).toHaveAttribute('aria-label', ADD_TO_FAVORITES_LABEL);

        const icon = button.querySelector('i');
        expect(icon).toHaveClass('icon-star-outline');
    });

    it('should render "Remove from Favorites" button when favorite', () => {
        isCurrentChannelFavoriteMock.mockReturnValue(true);
        getCurrentChannelMock.mockReturnValue(activeChannel);

        renderComponent();

        const button = screen.getByRole('button', {name: REMOVE_FROM_FAVORITES_REGEX});
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('active');
        expect(button).toHaveAttribute('aria-label', REMOVE_FROM_FAVORITES_LABEL);

        const icon = button.querySelector('i');
        expect(icon).toHaveClass('icon-star');
    });

    it('should have correct aria-label and icon based on isFavorite', () => {
        // Start with Not favorite channel
        isCurrentChannelFavoriteMock.mockReturnValue(false);
        getCurrentChannelMock.mockReturnValue(activeChannel);

        renderComponent();

        let button = screen.getByRole('button', {name: ADD_TO_FAVORITES_REGEX});
        expect(button).toHaveAttribute('aria-label', ADD_TO_FAVORITES_LABEL);
        let icon = button.querySelector('i');
        expect(icon).toHaveClass('icon-star-outline');

        // Reset mocks to simulate favorite state
        vi.clearAllMocks();
        isCurrentChannelFavoriteMock = vi.spyOn(channelsSelectors, 'isCurrentChannelFavorite');
        getCurrentChannelMock = vi.spyOn(channelsSelectors, 'getCurrentChannel');

        isCurrentChannelFavoriteMock.mockReturnValue(true);
        getCurrentChannelMock.mockReturnValue(activeChannel);

        // Re-render component with updated state, now is Favorite
        renderComponent();

        button = screen.getByRole('button', {name: REMOVE_FROM_FAVORITES_REGEX});
        expect(button).toHaveAttribute('aria-label', REMOVE_FROM_FAVORITES_LABEL);
        icon = button.querySelector('i');
        expect(icon).toHaveClass('icon-star');
    });

    it('should dispatch A11yFocusEvent after toggling favorite', async () => {
        isCurrentChannelFavoriteMock.mockReturnValue(false);
        getCurrentChannelMock.mockReturnValue(activeChannel);

        vi.mocked(favoriteChannel).mockImplementation(() => ({
            type: 'FAVORITE_CHANNEL',
            data: activeChannel.id,
        }) as any);

        // Spy on document.dispatchEvent
        const dispatchEventSpy = vi.spyOn(document, 'dispatchEvent');

        renderComponent();

        const button = screen.getByRole('button', {name: ADD_TO_FAVORITES_REGEX});

        // Ensure the ref is set by triggering a focus event
        fireEvent.focus(button);

        act(() => {
            fireEvent.click(button);
        });

        expect(dispatchMock).toHaveBeenCalledWith({
            type: 'FAVORITE_CHANNEL',
            data: activeChannel.id,
        });

        await waitFor(() => {
            expect(dispatchEventSpy).toHaveBeenCalled();
        }, {
            timeout: 1000, // Increase timeout
        });

        // Verify the details of the dispatched event
        const focusEvents = dispatchEventSpy.mock.calls.
            filter((call) => call[0].type === A11yCustomEventTypes.FOCUS).
            map((call) => call[0] as CustomEvent<A11yFocusEventDetail>);

        expect(focusEvents.length).toBeGreaterThan(0);
        const event = focusEvents[focusEvents.length - 1];
        expect(event.detail.target).toBe(button);
        expect(event.detail.keyboardOnly).toBe(false);

        // Cleanup
        dispatchEventSpy.mockRestore();
    });
});
