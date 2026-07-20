// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import type {GlobalState} from 'types/store';

import RenewalLicenseCard from './renew_license_card';

const initialState: DeepPartial<GlobalState> = {
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

describe('components/RenewalLicenseCard', () => {
    const props = {
        license: {
            id: 'license_id',
            ExpiresAt: new Date().getMilliseconds().toString(),
            SkuShortName: 'skuShortName',
        },
        isLicenseExpired: false,
        totalUsers: 10,
        isDisabled: false,
    };

    test('should show Contact sales button', () => {
        renderWithContext(<RenewalLicenseCard {...props}/>, initialState);

        const buttons = screen.getAllByRole('button');
        expect(buttons).toHaveLength(1);
        expect(screen.getByText('Contact Sales')).toBeInTheDocument();
    });
});
