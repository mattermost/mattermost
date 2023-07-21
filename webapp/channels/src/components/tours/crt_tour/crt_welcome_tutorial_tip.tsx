// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMeasurePunchouts} from '@mattermost/components';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import CRTTourTip from './crt_tour_tip';

const CRTWelcomeTutorialTip = () => {
    const {formatMessage} = useIntl();
    const title = (
        <FormattedMessage
            id='tutorial_threads.welcome.title'
            defaultMessage={'Welcome to the Threads view!'}
        />
    );

    const screen = (
        <p>
            {formatMessage(
                {
                    id: 'tutorial_threads.welcome.description',
                    defaultMessage:
                        'All the conversations that you’re participating in or following will show here. If you have unread messages or mentions within your threads, you’ll see that here too.',

                })
            }
        </p>
    );

    const overlayPunchOut = useMeasurePunchouts(['sidebar-threads-button'], []);

    return (
        <CRTTourTip
            title={title}
            screen={screen}
            overlayPunchOut={overlayPunchOut}
            placement='right-start'
            pulsatingDotPlacement='right'
        />
    );
};

export default CRTWelcomeTutorialTip;
