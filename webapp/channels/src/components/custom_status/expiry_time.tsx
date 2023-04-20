// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import moment from 'moment-timezone';

import {FormattedMessage} from 'react-intl';

import Timestamp, {RelativeRanges} from 'components/timestamp';
import {Props as TimestampProps} from 'components/timestamp/timestamp';

import {getCurrentMomentForTimezone} from 'utils/timezone';

const CUSTOM_STATUS_EXPIRY_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.TOMORROW_TITLE_CASE,
];

interface Props {
    time: string;
    timezone?: string;
    className?: string;
    showPrefix?: boolean;
    withinBrackets?: boolean;
}

const ExpiryTime = ({time, timezone, className, showPrefix, withinBrackets}: Props) => {
    const currentMomentTime = getCurrentMomentForTimezone(timezone);
    const timestampProps: Partial<TimestampProps> = {
        value: time,
        ranges: CUSTOM_STATUS_EXPIRY_RANGES,
    };

    if (moment(time).isSame(currentMomentTime.clone().endOf('day')) || moment(time).isAfter(currentMomentTime.clone().add(1, 'day').endOf('day'))) {
        timestampProps.useTime = false;
    }

    if (moment(time).isBefore(currentMomentTime.clone().endOf('day'))) {
        timestampProps.useDate = false;
        delete timestampProps.ranges;
    }

    if (moment(time).isAfter(currentMomentTime.clone().add(1, 'day').endOf('day')) && moment(time).isBefore(currentMomentTime.clone().add(6, 'days'))) {
        timestampProps.useDate = {weekday: 'long'};
    }

    if (moment(time).isAfter(currentMomentTime.clone().add(6, 'days'))) {
        timestampProps.month = 'short';
    }

    if (moment(time).isAfter(currentMomentTime.clone().endOf('year'))) {
        timestampProps.year = 'numeric';
    }

    const prefix = showPrefix && (
        <>
            <FormattedMessage
                id='custom_status.expiry.until'
                defaultMessage='Until'
            />{' '}
        </>
    );

    return (
        <span className={className}>
            {withinBrackets && '('}
            {prefix}
            <Timestamp
                {...timestampProps}
            />
            {withinBrackets && ')'}
        </span>
    );
};

ExpiryTime.defaultProps = {
    showPrefix: true,
    withinBrackets: false,
};

export default React.memo(ExpiryTime);
