// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ShowStartTrialModal from 'components/announcement_bar/show_start_trial_modal/show_start_trial_modal';
import * as getTotalUsersHook from 'components/common/hooks/useGetTotalUsersNoBots';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

let mockState: any;
const mockDispatch = vi.fn();

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual as typeof import('react-redux'),
        useSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
        useDispatch: () => mockDispatch,
    };
});

describe('components/sidebar/show_start_trial_modal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDispatch.mockClear();

        const now = new Date().getTime();

        // required state to mount using the provider
        mockState = {
            entities: {
                admin: {
                    prevTrialLicense: {
                        IsLicensed: 'false',
                    },
                },
                preferences: {
                    myPreferences: {
                        'start_trial_modal--trial_modal_auto_shown': {
                            name: 'trial_modal_auto_shown',
                            value: 'false',
                        },
                    },
                },
                general: {
                    config: {
                        InstallationDate: now,
                    },
                    license: {
                        IsLicensed: 'false',
                    },
                },
                users: {
                    currentUserId: 'current_user_id',
                    profiles: {
                        current_user_id: {roles: 'system_user'},
                    },
                },
                roles: {
                    roles: {
                        system_role: {permissions: ['test_system_permission', 'add_user_to_team', 'invite_guest']},
                        team_role: {permissions: ['test_team_no_permission']},
                    },
                },
            },
            views: {
                modals: {
                    modalState: {
                        trial_benefits_modal: {
                            open: false,
                        },
                    },
                },
            },
        };
    });

    test('should match snapshot', () => {
        // Mock the hook to prevent async dispatch
        vi.spyOn(getTotalUsersHook, 'default').mockImplementation(() => 0);

        const {container} = renderWithContext(
            <ShowStartTrialModal/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should NOT dispatch the modal when there are less than 10 users', () => {
        const lessThan10Users = 9;
        vi.spyOn(getTotalUsersHook, 'default').mockImplementation(() => lessThan10Users);

        const isAdminUser = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_admin system_user'},
            },
        };

        const moreThan6Hours = {
            config: {

                // installation date is set to be 10 hours before current time
                InstallationDate: new Date().getTime() - ((10 * 60 * 60) * 1000),
            },
        };

        mockState = {...mockState, entities: {...mockState.entities, users: isAdminUser, general: moreThan6Hours}};

        renderWithContext(
            <ShowStartTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should NOT dispatch the modal when the env has less than 6 hours of creation', () => {
        const isAdminUser = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_admin system_user'},
            },
        };

        const moreThan10Users = 11;

        vi.spyOn(getTotalUsersHook, 'default').mockImplementation(() => moreThan10Users);

        const lessThan6Hours = {
            config: {

                // installation date is set to be 5 hours before current time
                InstallationDate: new Date().getTime() - ((5 * 60 * 60) * 1000),
            },
        };

        mockState = {...mockState, entities: {...mockState.entities, users: isAdminUser, general: lessThan6Hours}};

        renderWithContext(
            <ShowStartTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should NOT dispatch the modal when the env has previous license', () => {
        const isAdminUser = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_admin system_user'},
            },
        };

        const moreThan10UsersAndPrevLicensed = {
            prevTrialLicense: {
                IsLicensed: 'true',
            },
        };

        const moreThan10Users = 11;
        vi.spyOn(getTotalUsersHook, 'default').mockImplementation(() => moreThan10Users);

        mockState = {...mockState, entities: {...mockState.entities, users: isAdminUser, admin: moreThan10UsersAndPrevLicensed}};

        renderWithContext(
            <ShowStartTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should NOT dispatch the modal when the env is currently licensed', () => {
        const isAdminUser = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_admin system_user'},
            },
        };

        const moreThan10Users = 11;
        vi.spyOn(getTotalUsersHook, 'default').mockImplementation(() => moreThan10Users);

        const moreThan6HoursAndLicensed = {
            config: {

                // installation date is set to be 10 hours before current time
                InstallationDate: new Date().getTime() - ((10 * 60 * 60) * 1000),
            },
            license: {
                IsLicensed: 'true',
            },
        };

        mockState = {...mockState, entities: {...mockState.entities, users: isAdminUser, general: moreThan6HoursAndLicensed}};

        renderWithContext(
            <ShowStartTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should NOT dispatch the modal when the modal has been already dismissed', () => {
        const isAdminUser = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_admin system_user'},
            },
        };

        const moreThan10Users = 11;
        vi.spyOn(getTotalUsersHook, 'default').mockImplementation(() => moreThan10Users);

        const moreThan6Hours = {
            config: {

                // installation date is set to be 10 hours before current time
                InstallationDate: new Date().getTime() - ((10 * 60 * 60) * 1000),
            },
        };

        const modalDismissed = {
            myPreferences: {
                'start_trial_modal--trial_modal_auto_shown': {
                    name: 'trial_modal_auto_shown',
                    value: 'true',
                },
            },
        };

        mockState = {
            ...mockState,
            entities: {
                ...mockState.entities,
                users: isAdminUser,
                general: moreThan6Hours,
                preferences: modalDismissed,
            },
        };

        renderWithContext(
            <ShowStartTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should NOT dispatch the modal when user is not an admin', () => {
        const isAdminUser = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_user'},
            },
        };

        const moreThan10Users = 11;
        vi.spyOn(getTotalUsersHook, 'default').mockImplementation(() => moreThan10Users);

        const notPreviouslyLicensed = {
            prevTrialLicense: {
                IsLicensed: 'false',
            },
        };

        const moreThan6Hours = {
            config: {

                // installation date is set to be 10 hours before current time
                InstallationDate: new Date().getTime() - ((10 * 60 * 60) * 1000),
            },
            license: {
                IsLicensed: 'false',
            },
        };

        mockState = {...mockState, entities: {...mockState.entities, users: isAdminUser, admin: notPreviouslyLicensed, general: moreThan6Hours}};

        renderWithContext(
            <ShowStartTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(0);
    });

    test('should dispatch the modal when there are more than 10 users', () => {
        const isAdminUser = {
            currentUserId: 'current_user_id',
            profiles: {
                current_user_id: {roles: 'system_admin system_user'},
            },
        };

        const moreThan10Users = 11;
        vi.spyOn(getTotalUsersHook, 'default').mockImplementation(() => moreThan10Users);

        const notPreviouslyLicensed = {
            prevTrialLicense: {
                IsLicensed: 'false',
            },
        };

        const moreThan6Hours = {
            config: {

                // installation date is set to be 10 hours before current time
                InstallationDate: new Date().getTime() - ((10 * 60 * 60) * 1000),
                SQLDriverName: 'postgres',
            },
            license: {
                IsLicensed: 'false',
            },
        };

        mockState = {...mockState, entities: {...mockState.entities, users: isAdminUser, admin: notPreviouslyLicensed, general: moreThan6Hours}};

        renderWithContext(
            <ShowStartTrialModal/>,
        );
        expect(mockDispatch).toHaveBeenCalledTimes(1);
    });
});
