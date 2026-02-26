// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as ChannelSelectors from 'mattermost-redux/selectors/entities/channels';

import {renderWithContext} from 'tests/react_testing_utils';

import NotifyCounts from './';

describe('components/notify_counts', () => {
    const getUnreadStatusInCurrentTeam = jest.spyOn(ChannelSelectors, 'getUnreadStatusInCurrentTeam');

    test('should show unread mention count', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(22);

        const {container} = renderWithContext(<NotifyCounts/>);

        expect(container.querySelector('.badge-notify')?.textContent).toBe('22');
    });

    test('should show unread messages', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(true);

        const {container} = renderWithContext(<NotifyCounts/>);

        expect(container.querySelector('.badge-notify')?.textContent).toBe('•');
    });

    test('should show not show unread indicator', () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(false);

        const {container} = renderWithContext(<NotifyCounts/>);

        expect(container.querySelector('.badge-notify')).toBeNull();
    });
});
