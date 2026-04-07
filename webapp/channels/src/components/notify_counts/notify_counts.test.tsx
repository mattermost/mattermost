// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as ChannelSelectors from 'mattermost-redux/selectors/entities/channels';

import {renderWithContext} from 'tests/react_testing_utils';

import NotifyCounts from './';

describe('components/notify_counts', () => {
    const getUnreadStatusInCurrentTeam = jest.spyOn(ChannelSelectors, 'getUnreadStatusInCurrentTeam');

    test('should show unread mention count', async () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(22);

        const {container} = await renderWithContext(<NotifyCounts/>);

        expect(container.querySelector('.badge-notify')?.textContent).toBe('22');
    });

    test('should show unread messages', async () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(true);

        const {container} = await renderWithContext(<NotifyCounts/>);

        expect(container.querySelector('.badge-notify')?.textContent).toBe('•');
    });

    test('should show not show unread indicator', async () => {
        getUnreadStatusInCurrentTeam.mockReturnValue(false);

        const {container} = await renderWithContext(<NotifyCounts/>);

        expect(container.querySelector('.badge-notify')).toBeNull();
    });
});
