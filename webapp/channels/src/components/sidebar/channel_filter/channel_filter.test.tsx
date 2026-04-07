// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ChannelFilterIntl from 'components/sidebar/channel_filter/channel_filter';

import {renderWithContext, fireEvent} from 'tests/react_testing_utils';

describe('components/sidebar/channel_filter', () => {
    const baseProps = {
        unreadFilterEnabled: false,
        hasMultipleTeams: false,
        actions: {
            setUnreadFilterEnabled: jest.fn(),
        },
    };

    test('should match snapshot', async () => {
        const {container} = await renderWithContext(
            <ChannelFilterIntl {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if the unread filter is enabled', async () => {
        const props = {
            ...baseProps,
            unreadFilterEnabled: true,
        };

        const {container} = await renderWithContext(
            <ChannelFilterIntl {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should enable the unread filter on toggle when it is disabled', async () => {
        const {container} = await renderWithContext(
            <ChannelFilterIntl {...baseProps}/>,
        );
        const filterButton = container.querySelector('.SidebarFilters_filterButton')!;
        fireEvent.click(filterButton);

        expect(baseProps.actions.setUnreadFilterEnabled).toHaveBeenCalledWith(true);
    });

    test('should disable the unread filter on toggle when it is enabled', async () => {
        const props = {
            ...baseProps,
            unreadFilterEnabled: true,
        };

        const {container} = await renderWithContext(
            <ChannelFilterIntl {...props}/>,
        );
        const filterButton = container.querySelector('.SidebarFilters_filterButton')!;
        fireEvent.click(filterButton);

        expect(baseProps.actions.setUnreadFilterEnabled).toHaveBeenCalledWith(false);
    });
});
