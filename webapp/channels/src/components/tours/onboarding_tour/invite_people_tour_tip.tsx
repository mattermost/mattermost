// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMeasurePunchouts} from '@mattermost/components';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import OnboardingTourTip from './onboarding_tour_tip';

const translate = {x: 0, y: -18};

export const InvitePeopleTour = () => {
    const title = (
        <FormattedMessage
            id='onboardingTour.invitePeople.title'
            defaultMessage={'Invite people to the team'}
        />
    );
    const screen = (
        <p>
            <FormattedMessage
                id='onboardingTour.invitePeople.Description'
                defaultMessage={'Invite members of your organization or external guests to the team and start collaborating with them.'}
            />
        </p>
    );

    const overlayPunchOut = useMeasurePunchouts(['invitePeople'], [], {y: -8, height: 16, x: 0, width: 0});

    return (
        <OnboardingTourTip
            title={title}
            screen={screen}
            placement='right-start'
            pulsatingDotPlacement='right-end'
            pulsatingDotTranslate={translate}
            width={352}
            overlayPunchOut={overlayPunchOut}
        />
    );
};
