// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {ChannelsTourTip, TutorialTourName} from 'components/tours';
import type {ChannelsTourTipProps} from 'components/tours';

const OnboardingExploreToolsTourTip = (props: Omit<ChannelsTourTipProps, 'tourCategory'>) => {
    return (
        <ChannelsTourTip
            {...props}
            tourCategory={TutorialTourName.EXPLORE_OTHER_TOOLS}
        />
    );
};

export default OnboardingExploreToolsTourTip;
