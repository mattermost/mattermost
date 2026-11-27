// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {HealthFinding} from '@mattermost/types/health';

import RelativeTime from './relative_time';

const durationMessages = defineMessages({
    days: {id: 'admin.health_dashboard.duration.whole_days', defaultMessage: '{days, plural, one {# day} other {# days}}'},
    hours: {id: 'admin.health_dashboard.duration.whole_hours', defaultMessage: '{hours, plural, one {# hour} other {# hours}}'},
    minutes: {id: 'admin.health_dashboard.duration.whole_minutes', defaultMessage: '{minutes, plural, one {# minute} other {# minutes}}'},
});

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// One rounded unit, such as "22 hours", never shorter than a minute. The breakpoints match
// RelativeTime's, so a duration and a relative time on the page round the same way.
export function formatDuration(ms: number, formatMessage: IntlShape['formatMessage']) {
    if (ms < 59.5 * MINUTE) {
        return formatMessage(durationMessages.minutes, {minutes: Math.max(Math.round(ms / MINUTE), 1)});
    }
    if (ms < 23.5 * HOUR) {
        return formatMessage(durationMessages.hours, {hours: Math.round(ms / HOUR)});
    }
    return formatMessage(durationMessages.days, {days: Math.round(ms / DAY)});
}

type Props = {
    finding: HealthFinding;
    now: number;
};

const Trend = ({finding, now}: Props) => {
    const {formatMessage} = useIntl();

    if (finding.state === 'resolved') {
        return (
            <FormattedMessage
                id='admin.health_dashboard.trend.resolved'
                defaultMessage='Resolved {time}'
                values={{time: <RelativeTime value={finding.state_since}/>}}
            />
        );
    }

    const duration = formatDuration(now - finding.state_since, formatMessage);
    if (finding.state === 'unknown') {
        return (
            <FormattedMessage
                id='admin.health_dashboard.trend.unknown'
                defaultMessage='Not checked for {duration}'
                values={{duration}}
            />
        );
    }
    return (
        <FormattedMessage
            id='admin.health_dashboard.trend.firing'
            defaultMessage='Open for {duration}'
            values={{duration}}
        />
    );
};

export default Trend;
