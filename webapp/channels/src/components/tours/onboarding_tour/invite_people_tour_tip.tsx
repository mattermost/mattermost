// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {useMeasurePunchouts} from '@mattermost/components';

import {ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU} from 'components/sidebar/sidebar_header/sidebar_browse_or_add_channel_menu';

import OnboardingTourTip from './onboarding_tour_tip';

const translate = {x: -3, y: -25};

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

    const overlayPunchOut = useMeasurePunchouts([ELEMENT_ID_FOR_BROWSE_OR_ADD_CHANNEL_MENU], [], {x: -2.5, y: -2.5, width: 5, height: 5});

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
