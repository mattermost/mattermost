// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from 'types/store';

export function isShowOnboardingTaskCompletion(state: GlobalState) {
    return state.views.onboardingTasks.isShowOnboardingTaskCompletion;
}

export function isShowOnboardingCompleteProfileTour(state: GlobalState) {
    return state.views.onboardingTasks.isShowOnboardingCompleteProfileTour;
}

export function isShowOnboardingVisitConsoleTour(state: GlobalState) {
    return state.views.onboardingTasks.isShowOnboardingVisitConsoleTour;
}
