// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {TimestampFormat} from '@mattermost/types/config';

import Timestamp, {supportsHourCycle} from 'components/timestamp';
import SemanticTime from 'components/timestamp/semantic_time';

import {
    formatFullDateTimeForTooltip,
    formatInlineTimestamp,
    resolveTimestampDisplayTier,
    type TimestampDisplayContext,
    type TimestampDisplayTier,
} from 'utils/datetime_display_format';

export type Props = {
    value: number | Date;
    className?: string;
    timestampFormat: TimestampFormat;
    showTimestampSeconds: boolean;
    timeZone?: string;
    useMilitaryTime: boolean;
    showTooltip?: boolean;
    displayContext?: TimestampDisplayContext;
    tier?: TimestampDisplayTier;
    isConsecutivePost?: boolean;
    forceTimeOnly?: boolean;
};

function EventTimestamp({
    value,
    className,
    timestampFormat,
    showTimestampSeconds,
    timeZone,
    useMilitaryTime,
    showTooltip = true,
    displayContext = 'post',
    tier,
    isConsecutivePost = false,
    forceTimeOnly = false,
}: Props) {
    const intl = useIntl();
    const dateValue = value instanceof Date ? value : new Date(value);
    const effectiveTier = resolveTimestampDisplayTier(timestampFormat, displayContext, tier, forceTimeOnly);
    const effectiveShowSeconds = showTimestampSeconds && !forceTimeOnly;

    let inlineContent: React.ReactNode;

    if (displayContext === 'post' && effectiveTier === 'time_only') {
        inlineContent = (
            <Timestamp
                value={dateValue}
                className={className}
                timeZone={timeZone}
                hourCycle={useMilitaryTime ? 'h23' : 'h12'}
                hour12={supportsHourCycle ? undefined : !useMilitaryTime}
                useDate={false}
                useTime={{
                    hour: 'numeric',
                    minute: '2-digit',
                    ...(effectiveShowSeconds ? {second: '2-digit'} : {}),
                }}
                style={isConsecutivePost ? 'narrow' : undefined}
            />
        );
    } else {
        const formatted = formatInlineTimestamp(dateValue, timestampFormat, {
            timeZone,
            useMilitaryTime,
            showTimestampSeconds,
            context: displayContext,
            tier: effectiveTier,
            forceTimeOnly,
            intl,
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
