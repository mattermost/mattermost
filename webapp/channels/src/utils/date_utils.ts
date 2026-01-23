// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseISO, isValid, format} from 'date-fns';
import type {Moment} from 'moment-timezone';

import {getCurrentMomentForTimezone, parseDateInTimezone} from './timezone';

export enum DateReference {

    // Absolute
    TODAY = 'today',
    TOMORROW = 'tomorrow',
    YESTERDAY = 'yesterday',
}

export const DATE_FORMAT = 'yyyy-MM-dd';
const MOMENT_DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss[Z]';

/**
 * Convert a string value (ISO format or relative) to a Moment object
 * For date-only fields, datetime formats are accepted and the date portion is extracted
 */
export function stringToMoment(value: string | null, timezone?: string): Moment | null {
    if (!value) {
        return null;
    }

    // Handle relative dates/times
    const relativeMoment = resolveRelativeDateToMoment(value, timezone);
    if (relativeMoment) {
        return relativeMoment;
    }

    try {
        const parsedDate = parseISO(value);
        if (!isValid(parsedDate)) {
            return null;
        }
    } catch (error) {
        return null;
    }

    // parseISO validation passed, now parse with timezone handling
    return parseDateInTimezone(value, timezone);
}

/**
 * Convert a Moment object to an ISO string for storage
 *
 * For datetime fields, always stores in UTC format (YYYY-MM-DDTHH:mm:ssZ) for consistent
 * server processing. Input moment can be in any timezone - .utc() handles the conversion
 * correctly. The stored UTC value can be correctly translated back to any display timezone.
 *
 * For date fields, stores in local date format (YYYY-MM-DD) since timezone is not relevant.
 */
export function momentToString(momentValue: Moment | null, isDateTime: boolean): string | null {
    if (!momentValue || !momentValue.isValid()) {
        return null;
    }

    if (isDateTime) {
        return momentValue.utc().format(MOMENT_DATETIME_FORMAT);
    }

    // Store date only: "2025-01-14"
    const date = momentValue.toDate();
    return format(date, DATE_FORMAT);
}

/**
 * Resolve relative date references to Moment objects (internal helper)
 */
function resolveRelativeDateToMoment(dateStr: string, timezone?: string): Moment | null {
    // Get current time in timezone
    const now = getCurrentMomentForTimezone(timezone);

    switch (dateStr) {
    case DateReference.TODAY:
        return now.startOf('day');

    case DateReference.TOMORROW:
        return now.add(1, 'day').startOf('day');

    case DateReference.YESTERDAY:
        return now.subtract(1, 'day').startOf('day');

    default: {
        // Handle dynamic patterns like "+5d", "+2w", "+1m"
        const dynamicMatch = dateStr.match(/^([+-]\d{1,4})([dwm])$/i);
        if (dynamicMatch) {
            const [, amount, unit] = dynamicMatch;
            const value = parseInt(amount, 10);

            if (Math.abs(value) > 9999) {
                return null;
            }

            let momentUnit: moment.unitOfTime.DurationConstructor;

            switch (unit.toLowerCase()) {
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
                return null;
            }
        }

        return null;
    }
    }
}

/**
 * Resolve relative date references to ISO strings
 */
export function resolveRelativeDate(dateStr: string, timezone?: string): string {
    const relativeMoment = resolveRelativeDateToMoment(dateStr, timezone);
    if (relativeMoment) {
        return format(relativeMoment.toDate(), DATE_FORMAT);
    }

    return dateStr;
}

/**
 * Parse a date string (ISO format or relative) to a Date object
 * For date-only fields - no timezone conversion needed
 */
export function stringToDate(value: string | null): Date | null {
    if (!value) {
        return null;
    }

    // Handle relative dates first
    const resolved = resolveRelativeDate(value);

    // Parse ISO date string
    try {
        const parsed = parseISO(resolved);
        if (!isValid(parsed)) {
            return null;
        }
        return parsed;
    } catch (error) {
        return null;
    }
}

/**
 * Convert a Date object to ISO date string (YYYY-MM-DD)
 * For date-only fields - no timezone conversion needed
 */
export function dateToString(date: Date | null): string | null {
    if (!date || isNaN(date.getTime())) {
        return null;
    }
    return format(date, DATE_FORMAT);
}

