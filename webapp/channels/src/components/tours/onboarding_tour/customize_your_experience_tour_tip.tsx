// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {useMeasurePunchouts} from '@mattermost/components';

import CustomImg from 'images/Customize-Your-Experience.gif';

import OnboardingTourTip from './onboarding_tour_tip';

const translate = {x: 20, y: -6};
const offset: [number, number] = [18, 4];

export const CustomizeYourExperienceTour = () => {
    const title = (
        <FormattedMessage
            id='onboardingTour.customizeYourExperience.title'
            defaultMessage={'Customize your experience'}
        />
    );
    const screen = (
        <p>
            <FormattedMessage
                id='onboardingTour.customizeYourExperience.Description'
                defaultMessage={'Set your availability, add a custom status, and access Settings and your Profile to configure your experience, including notification preferences and custom theme colors.'}
            />
        </p>
    );

    const overlayPunchOut = useMeasurePunchouts(['RightControlsContainer'], [], {y: 6, height: -6, x: 64, width: 0});

    return (
        <OnboardingTourTip
            title={title}
            screen={screen}
            imageURL={CustomImg}
            placement='bottom-start'
            pulsatingDotPlacement='bottom'
            pulsatingDotTranslate={translate}
            offset={offset}
            width={352}
            overlayPunchOut={overlayPunchOut}
        />
    );
};

