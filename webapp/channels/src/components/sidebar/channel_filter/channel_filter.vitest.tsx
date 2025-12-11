// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ChannelFilterIntl from 'components/sidebar/channel_filter/channel_filter';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

describe('components/sidebar/channel_filter', () => {
    const baseProps = {
        unreadFilterEnabled: false,
        hasMultipleTeams: false,
        actions: {
            setUnreadFilterEnabled: vi.fn(),
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
        const setUnreadFilterEnabled = vi.fn();
        const props = {
            ...baseProps,
            actions: {
                setUnreadFilterEnabled,
            },
        };

        renderWithContext(
            <ChannelFilterIntl {...props}/>,
        );

        const filterButton = screen.getByRole('link', {name: /unreads filter/i});
        fireEvent.click(filterButton);

        expect(setUnreadFilterEnabled).toHaveBeenCalledWith(true);
    });

    test('should disable the unread filter on toggle when it is enabled', () => {
        const setUnreadFilterEnabled = vi.fn();
        const props = {
            ...baseProps,
            unreadFilterEnabled: true,
            actions: {
                setUnreadFilterEnabled,
            },
        };

        renderWithContext(
            <ChannelFilterIntl {...props}/>,
        );

        const filterButton = screen.getByRole('link', {name: /unreads filter/i});
        fireEvent.click(filterButton);

        expect(setUnreadFilterEnabled).toHaveBeenCalledWith(false);
    });
});
