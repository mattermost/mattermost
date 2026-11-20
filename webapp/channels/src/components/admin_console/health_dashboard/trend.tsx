// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import type {IntlShape} from 'react-intl';

import type {HealthFinding} from '@mattermost/types/health';

import RelativeTime from './relative_time';

const durationMessages = defineMessages({
    daysHours: {id: 'admin.health_dashboard.duration.days_hours', defaultMessage: '{days}d {hours}h'},
    days: {id: 'admin.health_dashboard.duration.days', defaultMessage: '{days}d'},
    hoursMinutes: {id: 'admin.health_dashboard.duration.hours_minutes', defaultMessage: '{hours}h {minutes}m'},
    hours: {id: 'admin.health_dashboard.duration.hours', defaultMessage: '{hours}h'},
    minutes: {id: 'admin.health_dashboard.duration.minutes', defaultMessage: '{minutes}m'},
});

// Compact duration such as "3d 4h" or "2h 5m", never shorter than a minute.
export function formatDuration(ms: number, formatMessage: IntlShape['formatMessage']) {
    const totalMinutes = Math.max(Math.floor(ms / 60000), 1);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;

    if (days > 0) {
        return formatMessage(hours > 0 ? durationMessages.daysHours : durationMessages.days, {days, hours});
    }
    if (totalHours > 0) {
        return formatMessage(minutes > 0 ? durationMessages.hoursMinutes : durationMessages.hours, {hours: totalHours, minutes});
    }
    return formatMessage(durationMessages.minutes, {minutes: totalMinutes});
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
                defaultMessage='Unevaluated for {duration}'
                values={{duration}}
            />
        );
    }
    return (
        <FormattedMessage
            id='admin.health_dashboard.trend.firing'
            defaultMessage='Firing for {duration}'
            values={{duration}}
        />
    );
};

export default Trend;
