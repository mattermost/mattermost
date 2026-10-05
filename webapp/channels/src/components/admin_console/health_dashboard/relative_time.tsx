// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Timestamp from 'components/timestamp';
import type {Props as TimestampProps} from 'components/timestamp/timestamp';

const UNITS: TimestampProps['units'] = ['now', 'minute', 'hour', 'day', 'week', 'month', 'year'];

const RelativeTime = ({value}: {value: number}) => (
    <Timestamp
        value={value}
        units={UNITS}
        useDate={false}
        useTime={false}
    />
);

export default RelativeTime;
