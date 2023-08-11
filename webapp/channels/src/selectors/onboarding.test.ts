// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getPreferenceKey} from 'mattermost-redux/utils/preference_utils';

import {getShowTaskListBool} from 'selectors/onboarding';

import {OnboardingTaskCategory, OnboardingTaskList} from 'components/onboarding_tasks';

import TestHelper from 'packages/mattermost-redux/test/test_helper';
import {RecommendedNextStepsLegacy, Preferences} from 'utils/constants';

import type {GlobalState} from 'types/store';

describe('selectors/onboarding', () => {
    describe('getShowTaskListBool', () => {
        test('first time user logs in aka firstTimeOnboarding', () => {
            const user = TestHelper.fakeUserWithId();

            const profiles = {
                [user.id]: user,
            };

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    preferences: {
                        myPreferences: {},
                    },
                    users: {
                        currentUserId: user.id,
                        profiles,
                    },
                },
            } as unknown as GlobalState;

            const [showTaskList, firstTimeOnboarding] = getShowTaskListBool(state);
            expect(showTaskList).toBeTruthy();
            expect(firstTimeOnboarding).toBeTruthy();
        });

        test('previous user skipped legacy next steps so not show the tasklist', () => {
            const prefSkip = {category: Preferences.RECOMMENDED_NEXT_STEPS, name: RecommendedNextStepsLegacy.SKIP, value: 'true'};
            const prefHide = {category: Preferences.RECOMMENDED_NEXT_STEPS, name: RecommendedNextStepsLegacy.HIDE, value: 'false'};

            const user = TestHelper.fakeUserWithId();

            const profiles = {
                [user.id]: user,
            };

            const state = {
                entities: {
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.RECOMMENDED_NEXT_STEPS, RecommendedNextStepsLegacy.HIDE)]: prefHide,
                            [getPreferenceKey(Preferences.RECOMMENDED_NEXT_STEPS, RecommendedNextStepsLegacy.SKIP)]: prefSkip,
                        },
                    },
                    users: {
                        currentUserId: user.id,
                        profiles,
                    },
                },
            } as unknown as GlobalState;

            const [showTaskList, firstTimeOnboarding] = getShowTaskListBool(state);
            expect(showTaskList).toBeFalsy();
            expect(firstTimeOnboarding).toBeFalsy();
        });

        test('previous user hided legacy next steps so not show the tasklist', () => {
            const prefSkip = {category: Preferences.RECOMMENDED_NEXT_STEPS, name: RecommendedNextStepsLegacy.SKIP, value: 'false'};
            const prefHide = {category: Preferences.RECOMMENDED_NEXT_STEPS, name: RecommendedNextStepsLegacy.HIDE, value: 'true'};

            const user = TestHelper.fakeUserWithId();

            const profiles = {
                [user.id]: user,
            };

            const state = {
                entities: {
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(Preferences.RECOMMENDED_NEXT_STEPS, RecommendedNextStepsLegacy.HIDE)]: prefHide,
                            [getPreferenceKey(Preferences.RECOMMENDED_NEXT_STEPS, RecommendedNextStepsLegacy.SKIP)]: prefSkip,
                        },
                    },
                    users: {
                        currentUserId: user.id,
                        profiles,
                    },
                },
            } as unknown as GlobalState;

            const [showTaskList, firstTimeOnboarding] = getShowTaskListBool(state);
            expect(showTaskList).toBeFalsy();
            expect(firstTimeOnboarding).toBeFalsy();
        });

        test('user has preferences set to true for showing the tasklist', () => {
            const prefShow = {category: OnboardingTaskCategory, name: OnboardingTaskList.ONBOARDING_TASK_LIST_SHOW, value: 'true'};
            const prefOpen = {category: OnboardingTaskCategory, name: OnboardingTaskList.ONBOARDING_TASK_LIST_OPEN, value: 'true'};

            const user = TestHelper.fakeUserWithId();

            const profiles = {
                [user.id]: user,
            };

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(OnboardingTaskCategory, OnboardingTaskList.ONBOARDING_TASK_LIST_SHOW)]: prefShow,
                            [getPreferenceKey(OnboardingTaskCategory, OnboardingTaskList.ONBOARDING_TASK_LIST_OPEN)]: prefOpen,
                        },
                    },
                    users: {
                        currentUserId: user.id,
                        profiles,
                    },
                },
            } as unknown as GlobalState;

            const [showTaskList, firstTimeOnboarding] = getShowTaskListBool(state);
            expect(showTaskList).toBeTruthy();
            expect(firstTimeOnboarding).toBeFalsy();
        });

        test('user has preferences set to false for showing the tasklist', () => {
            const prefSkip = {category: Preferences.RECOMMENDED_NEXT_STEPS, name: RecommendedNextStepsLegacy.SKIP, value: 'true'};
            const prefHide = {category: Preferences.RECOMMENDED_NEXT_STEPS, name: RecommendedNextStepsLegacy.HIDE, value: 'false'};
            const prefShow = {category: OnboardingTaskCategory, name: OnboardingTaskList.ONBOARDING_TASK_LIST_SHOW, value: 'false'};
            const prefOpen = {category: OnboardingTaskCategory, name: OnboardingTaskList.ONBOARDING_TASK_LIST_OPEN, value: 'false'};

            const user = TestHelper.fakeUserWithId();

            const profiles = {
                [user.id]: user,
            };

            const state = {
                entities: {
                    general: {
                        config: {},
                    },
                    preferences: {
                        myPreferences: {
                            [getPreferenceKey(OnboardingTaskCategory, OnboardingTaskList.ONBOARDING_TASK_LIST_SHOW)]: prefShow,
                            [getPreferenceKey(OnboardingTaskCategory, OnboardingTaskList.ONBOARDING_TASK_LIST_OPEN)]: prefOpen,
                            [getPreferenceKey(Preferences.RECOMMENDED_NEXT_STEPS, RecommendedNextStepsLegacy.SKIP)]: prefSkip,
                            [getPreferenceKey(Preferences.RECOMMENDED_NEXT_STEPS, RecommendedNextStepsLegacy.HIDE)]: prefHide,
                        },
                    },
                    users: {
                        currentUserId: user.id,
                        profiles,
                    },
                },
            } as unknown as GlobalState;

            const [showTaskList, firstTimeOnboarding] = getShowTaskListBool(state);
            expect(showTaskList).toBeFalsy();
            expect(firstTimeOnboarding).toBeFalsy();
        });
    });
});
