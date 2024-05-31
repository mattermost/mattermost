// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {useIntPreference} from 'components/common/hooks/usePreference';

import {TutorialTourName} from '../constant';

export const useShowOnboardingTutorialStep = (stepToShow: number): boolean => {
    const currentUserId = useSelector(getCurrentUserId);
    const step = useIntPreference(TutorialTourName.ONBOARDING_TUTORIAL_STEP, currentUserId, 0);
    return step === stepToShow;
};
