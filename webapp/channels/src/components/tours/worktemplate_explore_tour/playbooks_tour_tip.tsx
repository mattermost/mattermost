// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {useFollowElementDimensions, useMeasurePunchouts} from '@mattermost/components';

import {useShowTourTip} from './useShowTourTip';
import OnboardingWorkTemplateTourTip from './worktemplate_explore_tour_tip';

export const PlaybooksTourTip = (): JSX.Element | null => {
    const {formatMessage} = useIntl();
    const {playbooksCount, boardsCount, showPlaybooksTour} = useShowTourTip();
    const dimensions = useFollowElementDimensions('sidebar-right');
    const overlayPunchOut = useMeasurePunchouts(['sidebar-right'], [dimensions?.width]);

    if (!showPlaybooksTour) {
        return null;
    }

    const title = (
        <FormattedMessage
            id='pluggable_rhs.tourtip.playbooks.title'
            defaultMessage={'Access your {count} linked {count, plural, one {playbook} other {playbooks}}!'}
            values={{count: playbooksCount === 0 ? undefined : String(playbooksCount)}}
        />
    );

    const screen = (
        <ul>
            <li>
                {formatMessage({
                    id: 'pluggable_rhs.tourtip.playbooks.access',
                    defaultMessage: 'Access your linked playbooks from the Playbooks icon on the right hand App bar.',
                })}
            </li>
            <li>
                {formatMessage({
                    id: 'pluggable_rhs.tourtip.playbooks.click',
                    defaultMessage: 'Click into playbooks from this right panel.',
                })}
            </li>
            <li>
                {formatMessage({
                    id: 'pluggable_rhs.tourtip.playbooks.review',
                    defaultMessage: 'Review playbook updates from your channels.',
                })}
            </li>
        </ul>
    );

    return (
        <OnboardingWorkTemplateTourTip
            pulsatingDotPlacement={'left'}
            pulsatingDotTranslate={{x: 10, y: -140}}
            title={title}
            screen={screen}
            singleTip={boardsCount === 0}
            overlayPunchOut={overlayPunchOut}
            placement='left-start'
            showOptOut={false}
            interactivePunchOut={true}
        />
    );
};

