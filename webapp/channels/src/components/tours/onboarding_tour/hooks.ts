// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getInt} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {TutorialTourName} from '../constant';

import type {GlobalState} from 'types/store';

export const useShowOnboardingTutorialStep = (stepToShow: number): boolean => {
    const currentUserId = useSelector(getCurrentUserId);
    const boundGetInt = (state: GlobalState) => getInt(state, TutorialTourName.ONBOARDING_TUTORIAL_STEP, currentUserId, 0);
    const step = useSelector<GlobalState, number>(boundGetInt);
    return step === stepToShow;
};
