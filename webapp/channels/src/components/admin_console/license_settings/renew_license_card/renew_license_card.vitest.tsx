// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';

import type {GlobalState} from 'types/store';

import RenewalLicenseCard from './renew_license_card';

describe('components/RenewalLicenseCard', () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

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

    test('should show Contact sales button', async () => {
        renderWithContext(<RenewalLicenseCard {...props}/>, initialState);

        // Wait for the button to appear
        await waitFor(() => {
            expect(screen.getByRole('button', {name: /Contact Sales/i})).toBeInTheDocument();
        });
    });
});
