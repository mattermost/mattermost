// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RenewalLink from './renewal_link';

jest.mock('components/common/hooks/useOpenSalesLink', () => ({
    __esModule: true,
    default: () => [jest.fn()],
}));

const initialState = {
    views: {
        announcementBar: {
            announcementBarState: {
                announcementBarCount: 1,
            },
        },
    },
    entities: {
        general: {
            config: {
                CWSURL: '',
            },
            license: {
                IsLicensed: 'true',
                Cloud: 'true',
            },
        },
        users: {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        },
        preferences: {
            myPreferences: {},
        },
        cloud: {},
    },
};

describe('components/RenewalLink', () => {
    test('should show Contact sales button', async () => {
        renderWithContext(<RenewalLink/>, initialState);

        expect(screen.getByRole('button', {name: 'Contact sales'})).toBeInTheDocument();
    });
});
