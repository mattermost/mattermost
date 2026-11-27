// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Timestamp from 'components/timestamp';
import type {Props as TimestampProps} from 'components/timestamp/timestamp';

// One rounded unit of minutes, hours or days, with the same breakpoints as formatDuration. Days
// count elapsed time rather than calendar days, so there is no "yesterday".
const UNITS: TimestampProps['units'] = [
    {
        within: ['second', -45],
        display: (
            <FormattedMessage
                id='admin.health_dashboard.just_now'
                defaultMessage='just now'
            />
        ),
        updateIntervalInSeconds: 15,
    },
    {within: ['minute', -59.5], display: ['minute']},
    {within: ['hour', -23.5], display: ['hour']},
    {within: ['day', -Infinity, false], display: ['day', 1, false], updateIntervalInSeconds: 60 * 60},
];

const RelativeTime = ({value}: {value: number}) => (
    <Timestamp
        value={value}
        units={UNITS}
        numeric='always'
        useDate={false}
        useTime={false}
    />
);

export default RelativeTime;
