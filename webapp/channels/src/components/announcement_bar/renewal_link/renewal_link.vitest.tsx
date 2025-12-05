// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {RenewalLinkProps} from 'components/announcement_bar/renewal_link/renewal_link';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';

import RenewalLink from './renewal_link';

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
    afterEach(() => {
        vi.clearAllMocks();
    });

    const props: RenewalLinkProps = {
        actions: {
            openModal: vi.fn(),
        },
    };

    test('should show Contact sales button', async () => {
        renderWithContext(<RenewalLink {...props}/>, initialState);

        // wait for the promise to resolve and component to update
        await waitFor(() => {
            expect(screen.getByText('Contact sales')).toBeInTheDocument();
        });
    });
});
