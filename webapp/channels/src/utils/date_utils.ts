// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment, {type Moment} from 'moment-timezone';
import {useMemo} from 'react';

export enum DateReference {

    // Absolute
    TODAY = 'today',
    TOMORROW = 'tomorrow',
    YESTERDAY = 'yesterday',
}

// Regex to validate HH:MM time format (24-hour notation)
export const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Convert a string value (ISO format or relative) to a Moment object
 * For date-only fields, datetime formats are accepted and the date portion is extracted
 */
export function stringToMoment(value: string | null, timezone?: string, isDateTime?: boolean, strict?: boolean): Moment | null {
    if (!value) {
        return null;
    }

    // Handle relative dates/times - returns moment object directly to avoid double conversion
    const relativeMoment = resolveRelativeDateToMoment(value, timezone);
    if (relativeMoment) {
        return relativeMoment;
    }

    // Handle field type constraints
    let processedValue = value;
    if (isDateTime === false) {
        // For date-only fields, if a datetime string is provided, extract just the date portion
        if (value.includes('T')) {
            const datePortion = value.split('T')[0];

            // Update processedValue to just the date portion for further processing
            processedValue = datePortion;
        }
    }

    // Parse as ISO string with timezone validation
    let momentValue: moment.Moment;

    if (strict) {
        // Use strict parsing to reject ambiguous formats
        const formats = isDateTime ? ['YYYY-MM-DDTHH:mm:ss.SSSZ', 'YYYY-MM-DDTHH:mm:ssZ', 'YYYY-MM-DDTHH:mmZ'] : ['YYYY-MM-DD'];
        if (timezone && moment.tz.zone(timezone)) {
            momentValue = moment.tz(processedValue, formats, true, timezone);
        } else {
            momentValue = moment(processedValue, formats, true);
        }
    } else if (timezone && moment.tz.zone(timezone)) {
        momentValue = moment.tz(processedValue, timezone);
    } else {
        momentValue = moment(processedValue);
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
        // Store datetime in UTC format without seconds: "2025-01-14T14:30Z"
        return momentValue.utc().format('YYYY-MM-DDTHH:mm[Z]');
    }

    // Store date only: "2025-01-14"
    return momentValue.format('YYYY-MM-DD');
}

/**
 * Resolve relative date references to Moment objects (internal helper)
 */
function resolveRelativeDateToMoment(dateStr: string, timezone?: string): Moment | null {
    const now = timezone && moment.tz.zone(timezone) ? moment.tz(timezone) : moment();

    switch (dateStr) {
    case DateReference.TODAY:
        return now.startOf('day');

    case DateReference.TOMORROW:
        return now.add(1, 'day').startOf('day');

    case DateReference.YESTERDAY:
        return now.subtract(1, 'day').startOf('day');

    default: {
        // Handle dynamic patterns like "+5d", "+2w", "+1M" (limit to 4 digits for security)
        const dynamicMatch = dateStr.match(/^([+-]\d{1,4})([dwMH])$/);
        if (dynamicMatch) {
            const [, amount, unit] = dynamicMatch;
            const value = parseInt(amount, 10);

            // Additional bounds checking for security
            if (Math.abs(value) > 9999) {
                return null; // Return null if value is too large
            }

            let momentUnit: moment.unitOfTime.DurationConstructor;

            switch (unit) {
            case 'H':
                momentUnit = 'hour';
                return now.add(value, momentUnit);
            case 'd':
                momentUnit = 'day';
                return now.add(value, momentUnit).startOf('day');
            case 'w':
                momentUnit = 'week';
                return now.add(value, momentUnit).startOf('day');
            case 'M':
                momentUnit = 'month';
                return now.add(value, momentUnit).startOf('day');
            default:
                return null; // Return null if pattern not recognized
            }
        }

        // Return null if not a recognized relative reference
        return null;
    }
    }
}

/**
 * Resolve relative date references to ISO strings
 */
export function resolveRelativeDate(dateStr: string, timezone?: string): string {
    // Try to resolve as relative date/time
    const relativeMoment = resolveRelativeDateToMoment(dateStr, timezone);
    if (relativeMoment) {
        // Determine output format based on the type of relative reference
        const dynamicMatch = dateStr.match(/^([+-]\d{1,4})([dwMH])$/);
        const isTimePattern = dateStr.includes('H') || (dynamicMatch && dynamicMatch[2] === 'H');

        if (isTimePattern) {
            // Hour patterns return UTC datetime format without seconds
            return relativeMoment.utc().format('YYYY-MM-DDTHH:mm[Z]');
        }

        // Day/week/month patterns return date format
        return relativeMoment.format('YYYY-MM-DD');
    }

    // Return as-is if not a recognized relative reference
    return dateStr;
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

export interface DateValidationError {
    id: string;
    defaultMessage: string;
    values?: Record<string, string>;
}

/**
 * Validate if a date string is within min/max constraints
 * Returns structured validation error for internationalization
 */
export function validateDateRange(
    dateStr: string | null,
    minDate?: string,
    maxDate?: string,
    timezone?: string,
    locale?: string,
): DateValidationError | null {
    if (!dateStr) {
        return null;
    }

    const date = stringToMoment(dateStr, timezone);
    if (!date) {
        return {
            id: 'apps_form.date_field.invalid_format',
            defaultMessage: 'Invalid date format',
        };
    }

    if (minDate) {
        const min = stringToMoment(resolveRelativeDate(minDate, timezone), timezone);
        if (min && date.isBefore(min, 'day')) {
            // Format date for user preferences using Intl.DateTimeFormat
            const formattedDate = new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }).format(new Date(min.year(), min.month(), min.date()));

            return {
                id: 'apps_form.date_field.min_date_error',
                defaultMessage: 'Date must be after {minDate}',
                values: {minDate: formattedDate},
            };
        }
    }

    if (maxDate) {
        const max = stringToMoment(resolveRelativeDate(maxDate, timezone), timezone);
        if (max && date.isAfter(max, 'day')) {
            // Format date for user preferences using Intl.DateTimeFormat
            const formattedDate = new Intl.DateTimeFormat(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }).format(new Date(max.year(), max.month(), max.date()));

            return {
                id: 'apps_form.date_field.max_date_error',
                defaultMessage: 'Date must be before {maxDate}',
                values: {maxDate: formattedDate},
            };
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
        if (TIME_FORMAT_REGEX.test(defaultTime)) {
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

    return momentValue.utc().format('YYYY-MM-DDTHH:mm[Z]');
}
