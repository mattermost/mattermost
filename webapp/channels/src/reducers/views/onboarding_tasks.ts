// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {combineReducers} from 'redux';

import type {GenericAction} from 'mattermost-redux/types/actions';

import {ActionTypes} from 'utils/constants';

export function isShowOnboardingTaskCompletion(state = false, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.SHOW_ONBOARDING_TASK_COMPLETION:
        return action.open;
    default:
        return state;
    }
}

export function isShowOnboardingCompleteProfileTour(state = false, action: GenericAction) {
    switch (action.type) {
    case ActionTypes.SHOW_ONBOARDING_COMPLETE_PROFILE_TOUR:
        return action.open;
    default:
        return state;
    }
}

export function isShowOnboardingVisitConsoleTour(state = false, action: GenericAction) {
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
