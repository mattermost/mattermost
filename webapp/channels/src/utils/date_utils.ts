// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseISO, isValid} from 'date-fns';
import moment, {type Moment} from 'moment-timezone';
import {useMemo} from 'react';

export enum DateReference {

    // Absolute
    TODAY = 'today',
    TOMORROW = 'tomorrow',
    YESTERDAY = 'yesterday',
}

// Time validation regex for time-only validation
// HH:MM format (24-hour notation)
export const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

// RFC3339 datetime format with seconds for plugin compatibility
export const RFC3339_DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss[Z]';

/**
 * Convert a string value (ISO format or relative) to a Moment object
 * For date-only fields, datetime formats are accepted and the date portion is extracted
 */
export function stringToMoment(value: string | null, timezone?: string): Moment | null {
    if (!value) {
        return null;
    }

    // Handle relative dates/times - returns moment object directly to avoid double conversion
    const relativeMoment = resolveRelativeDateToMoment(value, timezone);
    if (relativeMoment) {
        return relativeMoment;
    }

    // Use parseISO for validation, but keep timezone logic separate
    let momentValue: moment.Moment;

    // First validate with parseISO
    try {
        const parsedDate = parseISO(value);
        if (!isValid(parsedDate)) {
            return null; // parseISO validation failed
        }
    } catch (error) {
        return null; // parseISO parsing failed
    }

    // parseISO validation passed, now use moment for timezone handling
    if (timezone && moment.tz.zone(timezone)) {
        momentValue = moment.tz(value, timezone);
    } else {
        momentValue = moment(value);
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
        // Store datetime in UTC format with seconds: "2025-01-14T14:30:00Z"
        return momentValue.utc().format(RFC3339_DATETIME_FORMAT);
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
        // Handle dynamic patterns like "+5d", "+2w", "+1m" (limit to 4 digits for security)
        const dynamicMatch = dateStr.match(/^([+-]\d{1,4})([dwm])$/);
        if (dynamicMatch) {
            const [, amount, unit] = dynamicMatch;
            const value = parseInt(amount, 10);

            // Additional bounds checking for security
            if (Math.abs(value) > 9999) {
                return null; // Return null if value is too large
            }

            let momentUnit: moment.unitOfTime.DurationConstructor;

            switch (unit) {
            case 'd':
                momentUnit = 'day';
                return now.add(value, momentUnit).startOf('day');
            case 'w':
                momentUnit = 'week';
                return now.add(value, momentUnit).startOf('day');
            case 'm':
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
        // All relative patterns (d/w/m) return date format since we removed hour support
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

