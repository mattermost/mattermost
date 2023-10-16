// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {mount} from 'enzyme';
import React from 'react';

import ShowThreeDaysLeftTrialModal from 'components/announcement_bar/show_tree_days_left_trial_modal/show_three_days_left_trial_modal';

import {CloudProducts} from 'utils/constants';
import {FileSizes} from 'utils/file_utils';

let mockState: any;
const mockDispatch = jest.fn();
const nowMiliseconds = new Date().getTime();
const oneDayMs = 24 * 60 * 60 * 1000;

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux') as typeof import('react-redux'),
    useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
    useDispatch: () => mockDispatch,
}));

describe('components/sidebar/show_three_days_left_trial_modal', () => {
    beforeEach(() => {
        // required state to mount using the provider
        mockState = {
            entities: {
                admin: {},
                preferences: {
                    myPreferences: {
                        'cloud_trial_banner--dismiss_3_days_left_trial_modal': {
                            name: 'dismiss_3_days_left_trial_modal',
                            value: 'false',
                        },
                    },
                },
                general: {
                    license: {
                        IsLicensed: 'true',
                        Cloud: 'true',
                    },
                },
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {roles: 'system_admin system_user'},
                    },
                },
                cloud: {
                    subscription: {
                        product_id: 'test_prod_1',
                        trial_end_at: nowMiliseconds + (2 * oneDayMs),
                        is_free_trial: 'true',
                    },
                    products: {
                        test_prod_1: {
                            id: 'test_prod_1',
                            sku: CloudProducts.STARTER,
                            price_per_seat: 0,
                        },
                        test_prod_2: {
                            id: 'test_prod_2',
                            sku: CloudProducts.ENTERPRISE,
                            price_per_seat: 0,
                        },
                        test_prod_3: {
                            id: 'test_prod_3',
                            sku: CloudProducts.PROFESSIONAL,
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
                roles: {
                    roles: {
                        system_role: {permissions: ['test_system_permission', 'add_user_to_team', 'invite_guest']},
                        team_role: {permissions: ['test_team_no_permission']},
                    },
                },
                usage: {
                    files: {
                        totalStorage: 0,
                        totalStorageLoaded: true,
                    },
                    messages: {
                        history: 0,
                        historyLoaded: true,
                    },
                    boards: {
                        cards: 0,
                        cardsLoaded: true,
                    },
                    integrations: {
                        enabled: 3,
                        enabledLoaded: true,
                    },
                    teams: {
                        active: 0,
                        cloudArchived: 0,
                        teamsLoaded: true,
                    },
                },
            },
            views: {
                modals: {
                    modalState: {
                        show_three_days_left_trial_modal: {
                            open: false,
                        },
                    },
                },
            },
        };
    });

    test('should show the modal when is cloud, free trial, admin, have not dimissed previously and there are less than 3 days in the trial, ', () => {
        mount(
            <ShowThreeDaysLeftTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });

    test('should NOT show the modal when user is not Admin', () => {
        const endUser = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        };

        mockState = {
            ...mockState,
            entities: {
                ...mockState.entities,
                users: endUser,
            },
        };

        mount(
            <ShowThreeDaysLeftTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should NOT show the modal when is not Cloud', () => {
        mockState = {...mockState, entities: {...mockState.entities, general: {...mockState.general, license: {Cloud: 'false'}}}};

        mount(
            <ShowThreeDaysLeftTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should NOT show the modal when is not Free Trial', () => {
        mockState = {
            ...mockState,
            entities: {
                ...mockState.entities,
                cloud: {
                    ...mockState.entities.cloud,
                    subscription: {
                        ...mockState.entities.cloud.subscription,
                        is_free_trial: 'false',
                    },
                },
            },
        };

        mount(
            <ShowThreeDaysLeftTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should NOT show the modal when there are MORE than three days left in the trial', () => {
        mockState = {
            ...mockState,
            entities: {
                ...mockState.entities,
                general: {
                    ...mockState.general,
                    license: {
                        Cloud: 'true',
                    },
                },
                cloud: {
                    ...mockState.entities.cloud,
                    subscription: {
                        ...mockState.entities.cloud.subscription,
                        is_free_trial: 'true',
                        trial_end_at: nowMiliseconds + (6 * oneDayMs),
                    },
                },
            },
        };
        mount(
            <ShowThreeDaysLeftTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should NOT show the modal when admin have already dismissed the modal', () => {
        const modalDismissedPreference = {
            myPreferences: {
                'cloud_trial_banner--dismiss_3_days_left_trial_modal': {
                    name: 'dismiss_3_days_left_trial_modal',
                    value: 'true',
                },
            },
        };

        mockState = {
            ...mockState,
            entities: {
                ...mockState.entities,
                preferences: modalDismissedPreference,
            },
        };
        mount(
            <ShowThreeDaysLeftTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });
});
