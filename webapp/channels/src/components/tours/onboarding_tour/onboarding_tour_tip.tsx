// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ChannelsTourTip, ChannelsTourTipProps, TutorialTourName} from 'components/tours';

const OnboardingTourTip = (props: Omit<ChannelsTourTipProps, 'tourCategory'>) => {
    return (
        <ChannelsTourTip
            {...props}
            tourCategory={TutorialTourName.ONBOARDING_TUTORIAL_STEP}
        />
    );
};

export default OnboardingTourTip;
