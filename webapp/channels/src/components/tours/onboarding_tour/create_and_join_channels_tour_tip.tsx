// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {useMeasurePunchouts} from '@mattermost/components';

import OnboardingTourTip from './onboarding_tour_tip';

const translate = {x: -3, y: 13};

export const CreateAndJoinChannelsTour = () => {
    const title = (
        <FormattedMessage
            id='onboardingTour.CreateAndJoinChannels.title'
            defaultMessage={'Create and join channels'}
        />
    );
    const screen = (
        <p>
            <FormattedMessage
                id='onboardingTour.CreateAndJoinChannels.Description'
                defaultMessage={'Create new channels or browse available channels to see what your team is discussing. As you join channels, organize them into  categories based on how you work.'}
            />
        </p>
    );

    const overlayPunchOut = useMeasurePunchouts(['browserOrAddChannelMenu'], [], {x: -2.5, y: -2.5, width: 5, height: 5});

    return (
        <OnboardingTourTip
            title={title}
            screen={screen}
            placement='right-start'
            pulsatingDotPlacement='right-start'
            pulsatingDotTranslate={translate}
            width={352}
            overlayPunchOut={overlayPunchOut}
        />
    );
};

