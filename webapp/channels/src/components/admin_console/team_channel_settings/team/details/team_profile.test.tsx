// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {CloudProducts} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';
import {TestHelper} from 'utils/test_helper';

import {TeamProfile} from './team_profile';

describe('admin_console/team_channel_settings/team/TeamProfile__Cloud', () => {
    const baseProps = {
        team: TestHelper.getTeamMock(),
        onToggleArchive: jest.fn(),
        isArchived: true,
    };

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
                license: {
                    IsLicensed: 'true',
                    Cloud: 'true',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin'},
                },
            },
            cloud: {
                subscription: {
                    product_id: 'test_prod_1',
                    trial_end_at: 1652807380,
                    is_free_trial: 'false',
                },
                products: {
                    test_prod_1: {
                        id: 'test_prod_1',
                        sku: CloudProducts.STARTER,
                        price_per_seat: 0,
                    },
                },
                limits: {
                    limitsLoaded: true,
                    limits: {
                        integrations: {
                            enabled: 10,
                        },
                        messages: {
                            history: 10000,
                        },
                        files: {
                            total_storage: FileSizes.Gigabyte,
                        },
                        teams: {
                            active: 1,
                        },
                        boards: {
                            cards: 500,
                            views: 5,
                        },
                    },
                },
            },
            usage: {
                integrations: {
                    enabled: 11,
                    enabledLoaded: true,
                },
                messages: {
                    history: 10000,
                    historyLoaded: true,
                },
                files: {
                    totalStorage: FileSizes.Gigabyte,
                    totalStorageLoaded: true,
                },
                teams: {
                    active: 1,
                    cloudArchived: 0,
                    teamsLoaded: true,
                },
                boards: {
                    cards: 500,
                    cardsLoaded: true,
                },
            },
        },
    };

    test('should match snapshot - archived, at teams limit', () => {
        const {container} = renderWithContext(<TeamProfile {...baseProps}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot - not archived, at teams limit', () => {
        const props = {
            ...baseProps,
            isArchived: false,
        };

        const {container} = renderWithContext(<TeamProfile {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('restore should not be disabled when below teams limit', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.cloud.limits = {
            limitsLoaded: true,
            limits: {
                integrations: {
                    enabled: 10,
                },
                messages: {
                    history: 10000,
                },
                files: {
                    total_storage: FileSizes.Gigabyte,
                },
                teams: {
                    active: 10,
                },
                boards: {
                    cards: 500,
                    views: 5,
                },
            },
        };
        state.entities.usage = {
            integrations: {
                enabled: 11,
                enabledLoaded: true,
            },
            messages: {
                history: 10000,
                historyLoaded: true,
            },
            files: {
                totalStorage: FileSizes.Gigabyte,
                totalStorageLoaded: true,
            },
            teams: {
                active: 1,
                cloudArchived: 0,
                teamsLoaded: true,
            },
            boards: {
                cards: 500,
                cardsLoaded: true,
            },
        };

        const {container} = renderWithContext(<TeamProfile {...baseProps}/>, state);
        expect(container).toMatchSnapshot();
    });
});

describe('admin_console/team_channel_settings/team/TeamProfile', () => {
    const baseProps = {
        team: TestHelper.getTeamMock(),
        onToggleArchive: jest.fn(),
        isArchived: false,
    };

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
                license: {
                    IsLicensed: 'true',
                    Cloud: 'false',
                },
            },
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: {roles: 'system_admin'},
                },
            },
            usage: {
                integrations: {
                    enabled: 0,
                    enabledLoaded: true,
                },
                messages: {
                    history: 0,
                    historyLoaded: true,
                },
                files: {
                    totalStorage: 0,
                    totalStorageLoaded: true,
                },
                teams: {
                    active: 0,
                    teamsLoaded: true,
                },
                boards: {
                    cards: 0,
                    cardsLoaded: true,
                },
            },
            cloud: {
                subscription: {
                    product_id: 'test_prod_1',
                    trial_end_at: 1652807380,
                    is_free_trial: 'false',
                },
                products: {
                    test_prod_1: {
                        id: 'test_prod_1',
                        sku: CloudProducts.STARTER,
                        price_per_seat: 0,
                    },
                },
                limits: {
                    limitsLoaded: true,
                    limits: {
                        integrations: {
                            enabled: 10,
                        },
                        messages: {
                            history: 10000,
                        },
                        files: {
                            total_storage: FileSizes.Gigabyte,
                        },
                        teams: {
                            active: 1,
                        },
                        boards: {
                            cards: 500,
                            views: 5,
                        },
                    },
                },
            },
        },
    };

    test('should match snapshot (not cloud, freemium disabled', () => {
        const {container} = renderWithContext(<TeamProfile {...baseProps}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with isArchived true', () => {
        const props = {
            ...baseProps,
            isArchived: true,
        };

        const {container} = renderWithContext(<TeamProfile {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });
});
