// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {useMeasurePunchouts} from '@mattermost/components';

import CRTTourTip from './crt_tour_tip';

const CRTUnreadTutorialTip = () => {
    const {formatMessage} = useIntl();
    const title = (
        <FormattedMessage
            id='tutorial_threads.unread.title'
            defaultMessage={'Unread threads'}
        />
    );

    const screen = (
        <p>
            {formatMessage(
                {
                    id: 'tutorial_threads.unread.description',
                    defaultMessage: 'You can switch to <b>Unreads</b> to show only threads that are unread.',
                },
                {
                    b: (value: string) => <b>{value}</b>,
                })
            }
        </p>
    );
    const overlayPunchOut = useMeasurePunchouts(['threads-list-unread-button'], []);

    return (
        <CRTTourTip
            title={title}
            screen={screen}
            overlayPunchOut={overlayPunchOut}
            placement='bottom-start'
            pulsatingDotPlacement='bottom'
        />
    );
};

export default CRTUnreadTutorialTip;
