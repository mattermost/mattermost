// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment, {type Moment} from 'moment-timezone';
import {useMemo} from 'react';

export enum DateReference {

    // Absolute
    TODAY = 'today',
    TOMORROW = 'tomorrow',
    YESTERDAY = 'yesterday',

    // Relative time (for datetime fields)
    PLUS_30M = '+30m',
    PLUS_1H = '+1h',
    PLUS_2H = '+2h',
    PLUS_4H = '+4h',

    // Relative days
    PLUS_1D = '+1d',
    PLUS_7D = '+7d',
    PLUS_30D = '+30d',

    // Relative weeks/months
    PLUS_1W = '+1w',
    PLUS_1M = '+1M',
    PLUS_3M = '+3M',
}

/**
 * Convert a string value (ISO format or relative) to a Moment object
 */
export function stringToMoment(value: string | null, timezone?: string): Moment | null {
    if (!value) {
        return null;
    }

    // Handle relative dates
    const resolved = resolveRelativeDate(value, timezone);

    // Parse as ISO string with timezone validation
    let momentValue: moment.Moment;

    if (timezone) {
        // Validate timezone to prevent potential attacks
        try {
            momentValue = moment.tz(resolved, timezone);

            // Additional check to ensure timezone is valid
            if (!moment.tz.zone(timezone)) {
                // Invalid timezone provided - fallback to local time
                momentValue = moment(resolved);
            }
        } catch (error) {
            // Error parsing timezone - fallback to local time
            momentValue = moment(resolved);
        }
    } else {
        momentValue = moment(resolved);
    }

    return momentValue.isValid() ? momentValue : null;
}

/**
 * Convert a Moment object to an ISO string for storage
 */
export function momentToString(momentValue: Moment | null, isDateTime: boolean): string | null {
    if (!momentValue || !momentValue.isValid()) {
        return null;
    }

    if (isDateTime) {
        // Store datetime in UTC format: "2025-01-14T14:30:00Z"
        return momentValue.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
    }

    // Store date only: "2025-01-14"
    return momentValue.format('YYYY-MM-DD');
}

/**
 * Resolve relative date references to ISO strings
 */
export function resolveRelativeDate(dateStr: string, timezone?: string): string {
    const now = timezone ? moment.tz(timezone) : moment();

    switch (dateStr) {
    case DateReference.TODAY:
        return now.format('YYYY-MM-DD');

    case DateReference.TOMORROW:
        return now.add(1, 'day').format('YYYY-MM-DD');

    case DateReference.YESTERDAY:
        return now.subtract(1, 'day').format('YYYY-MM-DD');

        // Relative time additions (for datetime fields)
    case DateReference.PLUS_30M:
        return now.add(30, 'minutes').utc().format('YYYY-MM-DDTHH:mm:ss[Z]');

    case DateReference.PLUS_1H:
        return now.add(1, 'hour').utc().format('YYYY-MM-DDTHH:mm:ss[Z]');

    case DateReference.PLUS_2H:
        return now.add(2, 'hours').utc().format('YYYY-MM-DDTHH:mm:ss[Z]');

    case DateReference.PLUS_4H:
        return now.add(4, 'hours').utc().format('YYYY-MM-DDTHH:mm:ss[Z]');

        // Relative day additions
    case DateReference.PLUS_1D:
        return now.add(1, 'day').format('YYYY-MM-DD');

    case DateReference.PLUS_7D:
        return now.add(7, 'days').format('YYYY-MM-DD');

    case DateReference.PLUS_30D:
        return now.add(30, 'days').format('YYYY-MM-DD');

        // Relative week/month additions
    case DateReference.PLUS_1W:
        return now.add(1, 'week').format('YYYY-MM-DD');

    case DateReference.PLUS_1M:
        return now.add(1, 'month').format('YYYY-MM-DD');

    case DateReference.PLUS_3M:
        return now.add(3, 'months').format('YYYY-MM-DD');

    default: {
        // Handle dynamic patterns like "+5d", "+2w", "+1M" (limit to 4 digits for security)
        const dynamicMatch = dateStr.match(/^([+-]\d{1,4})([dwMH])$/);
        if (dynamicMatch) {
            const [, amount, unit] = dynamicMatch;
            const value = parseInt(amount, 10);

            // Additional bounds checking for security
            if (Math.abs(value) > 9999) {
                return dateStr; // Return unchanged if value is too large
            }

            let momentUnit: moment.unitOfTime.DurationConstructor;
            let format: string;

            switch (unit) {
            case 'H':
                momentUnit = 'hour';
                format = 'YYYY-MM-DDTHH:mm:ss[Z]';
                return now.add(value, momentUnit).utc().format(format);
            case 'd':
                momentUnit = 'day';
                format = 'YYYY-MM-DD';
                break;
            case 'w':
                momentUnit = 'week';
                format = 'YYYY-MM-DD';
                break;
            case 'M':
                momentUnit = 'month';
                format = 'YYYY-MM-DD';
                break;
            default:
                return dateStr; // Return as-is if pattern not recognized
            }

            return now.add(value, momentUnit).format(format);
        }

        // Return as-is if not a recognized relative reference
        return dateStr;
    }
    }
}

/**
 * Hook to memoize relative date resolution based on timezone and current time
 */
export function useMemoizedRelativeDate(dateStr: string, timezone?: string): string {
    const currentMinute = Math.floor(Date.now() / (1000 * 60));

    return useMemo(() => {
        return resolveRelativeDate(dateStr, timezone);
    }, [dateStr, timezone, currentMinute]); // Re-compute every minute
}

/**
 * Validate if a date string is within min/max constraints
 */
export function validateDateRange(
    dateStr: string | null,
    minDate?: string,
    maxDate?: string,
    timezone?: string,
): string | null {
    if (!dateStr) {
        return null;
    }

    const date = stringToMoment(dateStr, timezone);
    if (!date) {
        return 'Invalid date format';
    }

    if (minDate) {
        const min = stringToMoment(resolveRelativeDate(minDate, timezone), timezone);
        if (min && date.isBefore(min, 'day')) {
            return `Date must be after ${min.format('MMM D, YYYY')}`;
        }
    }

    if (maxDate) {
        const max = stringToMoment(resolveRelativeDate(maxDate, timezone), timezone);
        if (max && date.isAfter(max, 'day')) {
            return `Date must be before ${max.format('MMM D, YYYY')}`;
        }
    }

    return null;
}

/**
 * Get default time string for datetime fields
 */
export function getDefaultTime(defaultTime?: string): string {
    if (defaultTime) {
        // Validate format HH:mm
        if ((/^([01]\d|2[0-3]):([0-5]\d)$/).test(defaultTime)) {
            return defaultTime;
        }
    }

    // Default to midnight
    return '00:00';
}

/**
 * Combine date and time strings into a datetime ISO string
 */
export function combineDateAndTime(
    dateStr: string,
    timeStr: string,
    timezone?: string,
): string {
    const dateTime = `${dateStr}T${timeStr}:00`;
    const momentValue = timezone ? moment.tz(dateTime, timezone) : moment(dateTime);

    return momentValue.utc().format('YYYY-MM-DDTHH:mm:ss[Z]');
}
