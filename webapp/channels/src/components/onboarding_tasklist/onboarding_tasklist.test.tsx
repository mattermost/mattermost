// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {OnboardingTaskCategory, OnboardingTaskList} from 'components/onboarding_tasks';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import OnBoardingTaskList from './onboarding_tasklist';

jest.mock('mattermost-redux/actions/admin', () => ({
    ...jest.requireActual('mattermost-redux/actions/admin'),
    getPrevTrialLicense: jest.fn(() => ({type: 'MOCK_GET_PREV_TRIAL_LICENSE'})),
}));

// Isolate the ServiceSettings.EnableOnboardingFlow gate from the unrelated
// onboarding-eligibility logic: force the task list to be shown so that the
// config value is the only remaining variable.
jest.mock('selectors/onboarding', () => ({
    ...jest.requireActual('selectors/onboarding'),
    getShowTaskListBool: () => [true, false],
}));

describe('components/onboarding_tasklist - EnableOnboardingFlow effect', () => {
    const currentUserId = 'current_user_id';

    const stateWithOnboardingFlow = (enableOnboardingFlow?: string) => ({
        entities: {
            users: {
                currentUserId,
                profiles: {
                    [currentUserId]: {id: currentUserId, roles: 'system_user'},
                },
            },
            general: {
                config: enableOnboardingFlow === undefined ? {} : {EnableOnboardingFlow: enableOnboardingFlow},
                license: {IsLicensed: 'false', Cloud: 'false'},
            },
            admin: {
                prevTrialLicense: {IsLicensed: 'false'},
            },
            cloud: {
                subscription: {},
            },
            preferences: {
                myPreferences: {
                    [getPreferenceKey(OnboardingTaskCategory, OnboardingTaskList.ONBOARDING_TASK_LIST_SHOW)]: {
                        category: OnboardingTaskCategory,
                        name: OnboardingTaskList.ONBOARDING_TASK_LIST_SHOW,
                        user_id: currentUserId,
                        value: 'true',
                    },
                },
            },
        },
    });

    const buttonName = 'Start the onboarding process.';

    test('renders the onboarding task list when EnableOnboardingFlow is true', () => {
        renderWithContext(<OnBoardingTaskList/>, stateWithOnboardingFlow('true'));

        expect(screen.getByLabelText(buttonName)).toBeInTheDocument();
    });

    test('hides the onboarding task list when EnableOnboardingFlow is false', () => {
        renderWithContext(<OnBoardingTaskList/>, stateWithOnboardingFlow('false'));

        expect(screen.queryByLabelText(buttonName)).not.toBeInTheDocument();
    });

    test('hides the onboarding task list when EnableOnboardingFlow is unset', () => {
        renderWithContext(<OnBoardingTaskList/>, stateWithOnboardingFlow());

        expect(screen.queryByLabelText(buttonName)).not.toBeInTheDocument();
    });
});
