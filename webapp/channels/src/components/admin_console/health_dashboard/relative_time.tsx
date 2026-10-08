// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Timestamp from 'components/timestamp';
import type {Props as TimestampProps} from 'components/timestamp/timestamp';

const UNITS: TimestampProps['units'] = [
    {
        within: ['second', -45],
        display: (
            <FormattedMessage
                id='admin.health_dashboard.just_now'
                defaultMessage='just now'
            />
        ),
    },
    'minute', 'hour', 'day', 'week', 'month', 'year',
];

const RelativeTime = ({value}: {value: number}) => (
    <Timestamp
        value={value}
        units={UNITS}
        useDate={false}
        useTime={false}
    />
);

export default RelativeTime;
