// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {IntlShape} from 'react-intl';

import {TimestampFormat} from '@mattermost/types/config';

export {TimestampFormat};

type TimeExampleOptions = {
    useMilitaryTime?: boolean;
    showTimestampSeconds?: boolean;
};

export function supportsTimestampSeconds(format: TimestampFormat): boolean {
    return format === TimestampFormat.STANDARD || format === TimestampFormat.DATE_AND_TIME;
}

/**
 * Date and Time renders long enough to need its own line in the post header,
 * unless the timestamp has been collapsed to a bare clock time.
 */
export function shouldWrapPostTimestamp(format: TimestampFormat, isCompact: boolean): boolean {
    return format === TimestampFormat.DATE_AND_TIME && !isCompact;
}

export function getTimestampFormatTimeExample(
    {useMilitaryTime = false, showTimestampSeconds = false}: TimeExampleOptions = {},
): string {
    if (useMilitaryTime) {
        return showTimestampSeconds ? '16:32:07' : '16:32';
    }

    return showTimestampSeconds ? '4:32:07 PM' : '4:32 PM';
}

export function getTimestampFormatOptionDisplayNameValues(options: TimeExampleOptions = {}) {
    return {
        timeExample: getTimestampFormatTimeExample(options),
    };
}

export function getTimestampFormatLabel(
    format: TimestampFormat,
    intl: IntlShape,
    options?: TimeExampleOptions,
): string {
    const timeExample = getTimestampFormatTimeExample(options);

    switch (format) {
    case TimestampFormat.RELATIVE:
        return intl.formatMessage({
            id: 'timestamp_format.relative',
            defaultMessage: 'Relative (example: 3 hours ago)',
        });
    case TimestampFormat.DATE_AND_TIME:
        return intl.formatMessage({
            id: 'timestamp_format.date_and_time',
            defaultMessage: 'Date and Time (example: Jun 1, {timeExample})',
        }, {timeExample});
    case TimestampFormat.STANDARD:
    default:
        return intl.formatMessage({
            id: 'timestamp_format.standard',
            defaultMessage: 'Standard (example: {timeExample})',
        }, {timeExample});
    }
}

export function getTimestampFormatShortLabel(
    format: TimestampFormat,
    intl: IntlShape,
): string {
    switch (format) {
    case TimestampFormat.RELATIVE:
        return intl.formatMessage({
            id: 'timestamp_format.relative_short',
            defaultMessage: 'Relative',
        });
    case TimestampFormat.DATE_AND_TIME:
        return intl.formatMessage({
            id: 'timestamp_format.date_and_time_short',
            defaultMessage: 'Date and Time',
        });
    case TimestampFormat.STANDARD:
    default:
        return intl.formatMessage({
            id: 'timestamp_format.standard_short',
            defaultMessage: 'Standard',
        });
    }
}

type AdminDisplaySettingsConfig = {
    DisplaySettings?: {
        ShowTimestampSeconds?: boolean;
    };
};

export function resolveAdminShowTimestampSeconds(
    config: AdminDisplaySettingsConfig,
    state: Record<string, unknown>,
): boolean {
    const stateValue = state['DisplaySettings.ShowTimestampSeconds'];
    if (stateValue != null) {
        return stateValue === true || stateValue === 'true';
    }

    return config.DisplaySettings?.ShowTimestampSeconds === true;
}
