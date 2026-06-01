// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentProps} from 'react';
import {useIntl} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {DateTimeDisplayFormat} from '@mattermost/types/config';

import Timestamp, {supportsHourCycle} from 'components/timestamp';
import SemanticTime from 'components/timestamp/semantic_time';

import {
    formatEventTimestamp,
    formatFullDateTimeForTooltip,
} from 'utils/datetime_display_format';

export type Props = {
    value: number | Date;
    className?: string;
    timestampProps?: ComponentProps<typeof Timestamp>;
    dateTimeDisplayFormat: DateTimeDisplayFormat;
    timeZone?: string;
    useMilitaryTime: boolean;
    showTooltip?: boolean;
    forceCompactFormat?: boolean;
};

const CONTEXT_TIMESTAMP_PROP_KEYS = new Set([
    'units',
    'ranges',
    'useDate',
    'useTime',
    'day',
    'month',
    'year',
    'weekday',
    'useRelative',
]);

function hasContextTimestampProps(timestampProps: ComponentProps<typeof Timestamp>): boolean {
    return Object.keys(timestampProps).some((key) => CONTEXT_TIMESTAMP_PROP_KEYS.has(key));
}

function EventTimestamp({
    value,
    className,
    timestampProps = {},
    dateTimeDisplayFormat,
    timeZone,
    useMilitaryTime,
    showTooltip = true,
    forceCompactFormat = false,
}: Props) {
    const intl = useIntl();
    const dateValue = value instanceof Date ? value : new Date(value);
    const useContextTimestampProps = hasContextTimestampProps(timestampProps);
    const inlineFormat = forceCompactFormat || useContextTimestampProps ?
        DateTimeDisplayFormat.COMPACT :
        dateTimeDisplayFormat;

    let inlineContent: React.ReactNode;
    if (inlineFormat === DateTimeDisplayFormat.COMPACT) {
        inlineContent = (
            <Timestamp
                value={dateValue}
                className={className}
                timeZone={timeZone}
                hourCycle={useMilitaryTime ? 'h23' : 'h12'}
                hour12={supportsHourCycle ? undefined : !useMilitaryTime}
                {...(useContextTimestampProps ? {} : {useDate: false})}
                {...timestampProps}
            />
        );
    } else {
        const formatted = formatEventTimestamp(dateValue, dateTimeDisplayFormat, {
            timeZone,
            useMilitaryTime,
        });

        inlineContent = (
            <SemanticTime
                value={dateValue}
                className={className}
                timeZone={timeZone}
            >
                {formatted}
            </SemanticTime>
        );
    }

    if (!showTooltip) {
        return inlineContent;
    }

    const tooltipTitle = formatFullDateTimeForTooltip(dateValue, intl, {
        timeZone,
        useMilitaryTime,
    });

    return (
        <WithTooltip title={tooltipTitle}>
            <span>{inlineContent}</span>
        </WithTooltip>
    );
}

export default EventTimestamp;
