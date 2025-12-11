// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as ChannelSelectors from 'mattermost-redux/selectors/entities/channels';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import NotifyCounts from './';

describe('components/notify_counts', () => {
    const getUnreadStatusInCurrentTeam = vi.spyOn(ChannelSelectors, 'getUnreadStatusInCurrentTeam');

    test('should show unread mention count', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(22);

        renderWithContext(<NotifyCounts/>);

        expect(screen.getByText('22')).toBeInTheDocument();
        expect(screen.getByText('22')).toHaveClass('badge-notify');
    });

    test('should show unread messages', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(true);

        renderWithContext(<NotifyCounts/>);

        expect(screen.getByText('•')).toBeInTheDocument();
        expect(screen.getByText('•')).toHaveClass('badge-notify');
    });

    test('should show not show unread indicator', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(false);

        const {container} = renderWithContext(<NotifyCounts/>);

        expect(container.innerHTML).toBe('');
    });
});
