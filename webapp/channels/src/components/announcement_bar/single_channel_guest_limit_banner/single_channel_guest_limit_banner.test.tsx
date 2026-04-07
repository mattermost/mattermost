// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import SingleChannelGuestLimitBanner from './index';

const baseState = {
    entities: {
        general: {
            license: {
                IsLicensed: 'true',
                SkuShortName: 'enterprise',
                GuestAccounts: 'true',
            },
            config: {
                EnableGuestAccounts: 'true',
            },
        },
        users: {
            currentUserId: 'user1',
            profiles: {
                user1: {id: 'user1', roles: 'system_admin'},
            },
        },
        preferences: {
            myPreferences: {},
        },
        limits: {
            serverLimits: {
                singleChannelGuestCount: 150,
                singleChannelGuestLimit: 100,
                activeUserCount: 50,
                maxUsersLimit: 0,
            },
        },
    },
};

const bannerMessage = 'Your workspace has reached the limit for single-channel guests';

describe('SingleChannelGuestLimitBanner', () => {
    test('does not render when user is not admin', async () => {
        await renderWithContext(
            <SingleChannelGuestLimitBanner userIsAdmin={false}/>,
            baseState,
        );

        expect(screen.queryByText(bannerMessage)).not.toBeInTheDocument();
    });

    test('does not render when guest count is within limit', async () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                limits: {
                    serverLimits: {
                        ...baseState.entities.limits.serverLimits,
                        singleChannelGuestCount: 50,
                        singleChannelGuestLimit: 100,
                    },
                },
            },
        };

        await renderWithContext(
            <SingleChannelGuestLimitBanner userIsAdmin={true}/>,
            state,
        );

        expect(screen.queryByText(bannerMessage)).not.toBeInTheDocument();
    });

    test('does not render when license is Entry SKU', async () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities.general,
                    license: {
                        ...baseState.entities.general.license,
                        SkuShortName: 'entry',
                    },
                },
            },
        };

        await renderWithContext(
            <SingleChannelGuestLimitBanner userIsAdmin={true}/>,
            state,
        );

        expect(screen.queryByText(bannerMessage)).not.toBeInTheDocument();
    });

    test('does not render when guest accounts are disabled', async () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                general: {
                    ...baseState.entities.general,
                    config: {
                        EnableGuestAccounts: 'false',
                    },
                },
            },
        };

        await renderWithContext(
            <SingleChannelGuestLimitBanner userIsAdmin={true}/>,
            state,
        );

        expect(screen.queryByText(bannerMessage)).not.toBeInTheDocument();
    });

    test('renders banner when guest count exceeds limit for admin user with eligible license', async () => {
        await renderWithContext(
            <SingleChannelGuestLimitBanner userIsAdmin={true}/>,
            baseState,
        );

        expect(screen.getByText(bannerMessage)).toBeInTheDocument();
    });

    test('does not render when banner has been dismissed', async () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                preferences: {
                    myPreferences: {
                        'sc_guest_limit_banner--single_channel_guest_limit': {
                            category: 'sc_guest_limit_banner',
                            name: 'single_channel_guest_limit',
                            value: 'true',
                        },
                    },
                },
            },
        };

        await renderWithContext(
            <SingleChannelGuestLimitBanner userIsAdmin={true}/>,
            state,
        );

        expect(screen.queryByText(bannerMessage)).not.toBeInTheDocument();
    });

    test('does not render when singleChannelGuestLimit is 0', async () => {
        const state = {
            ...baseState,
            entities: {
                ...baseState.entities,
                limits: {
                    serverLimits: {
                        ...baseState.entities.limits.serverLimits,
                        singleChannelGuestLimit: 0,
                    },
                },
            },
        };

        await renderWithContext(
            <SingleChannelGuestLimitBanner userIsAdmin={true}/>,
            state,
        );

        expect(screen.queryByText(bannerMessage)).not.toBeInTheDocument();
    });
});
