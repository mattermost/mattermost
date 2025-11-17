// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as ChannelSelectors from 'mattermost-redux/selectors/entities/channels';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import NotifyCounts from './';

describe('components/notify_counts', () => {
    const getUnreadStatusInCurrentTeam = jest.spyOn(ChannelSelectors, 'getUnreadStatusInCurrentTeam');

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should show unread mention count', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(22);

        renderWithContext(<NotifyCounts/>);

        // Verify the unread count is visible to users
        expect(screen.getByText('22')).toBeInTheDocument();
    });

    test('should show unread messages indicator', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(true);

        renderWithContext(<NotifyCounts/>);

        // Verify the unread indicator is visible to users
        expect(screen.getByText('•')).toBeInTheDocument();
    });

    test('should not show unread indicator when no unreads', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(false);

        const {container} = renderWithContext(<NotifyCounts/>);

        expect(container).toBeEmptyDOMElement();
    });
});
