// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import {ActionTypes} from 'utils/constants';

import type {MMAction} from 'types/store';

export function isShowOnboardingTaskCompletion(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SHOW_ONBOARDING_TASK_COMPLETION:
        return action.open;
    default:
        return state;
    }
}

export function isShowOnboardingCompleteProfileTour(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SHOW_ONBOARDING_COMPLETE_PROFILE_TOUR:
        return action.open;
    default:
        return state;
    }
}

export function isShowOnboardingVisitConsoleTour(state = false, action: MMAction) {
    switch (action.type) {
    case ActionTypes.SHOW_ONBOARDING_VISIT_CONSOLE_TOUR:
        return action.open;
    default:
        return state;
    }
}

export default combineReducers({
    isShowOnboardingTaskCompletion,
    isShowOnboardingCompleteProfileTour,
    isShowOnboardingVisitConsoleTour,
});
