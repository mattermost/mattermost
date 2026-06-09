// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import Timestamp, {RelativeRanges} from 'components/timestamp';

import './schedule_timezone_conversion_line.scss';

type Props = {
    selectedDateTime: Moment;
    useRecipientTimezone: boolean;
    recipientName: string;
    senderTimezone: string;
    recipientTimezone: string;
}

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.TOMORROW_TITLE_CASE,
];

const USE_TIME_HOUR_MINUTE_NUMERIC = {hour: 'numeric', minute: 'numeric'} as const;

export default function ScheduleTimezoneConversionLine({
    selectedDateTime,
    useRecipientTimezone,
    recipientName,
    senderTimezone,
    recipientTimezone,
}: Props) {
    const scheduledAt = selectedDateTime.valueOf();
    const displayTimezone = useRecipientTimezone ? senderTimezone : recipientTimezone;

    const dayLabel = (
        <Timestamp
            ranges={DATE_RANGES}
            value={scheduledAt}
            timeZone={displayTimezone}
            useTime={false}
        />
    );

    const timeLabel = (
        <Timestamp
            ranges={DATE_RANGES}
            value={scheduledAt}
            timeZone={displayTimezone}
            useDate={false}
            useTime={USE_TIME_HOUR_MINUTE_NUMERIC}
        />
    );

    return (
        <p
            className='ScheduleTimezoneConversionLine'
            aria-live='polite'
        >
            {useRecipientTimezone ? (
                <FormattedMessage
                    id='schedule_post.custom_time_modal.conversion_your_time'
                    defaultMessage='{day} at {time} your time'
                    values={{
                        day: dayLabel,
                        time: timeLabel,
                    }}
                />
            ) : (
                <FormattedMessage
                    id='schedule_post.custom_time_modal.conversion_recipient_time'
                    defaultMessage="{day} at {time} {recipientName}'s time"
                    values={{
                        day: dayLabel,
                        time: timeLabel,
                        recipientName,
                    }}
                />
            )}
        </p>
    );
}
