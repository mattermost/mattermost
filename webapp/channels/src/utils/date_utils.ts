// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {parseISO, isValid} from 'date-fns';
import moment, {type Moment} from 'moment-timezone';

export enum DateReference {

    // Absolute
    TODAY = 'today',
    TOMORROW = 'tomorrow',
    YESTERDAY = 'yesterday',
}

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

    // Handle relative dates/times
    const relativeMoment = resolveRelativeDateToMoment(value, timezone);
    if (relativeMoment) {
        return relativeMoment;
    }

    // Validate the date first
    try {
        const parsedDate = parseISO(value);
        if (!isValid(parsedDate)) {
            return null;
        }
    } catch (error) {
        return null;
    }

    // And then validate the timezone
    let momentValue: moment.Moment;
    if (timezone && moment.tz.zone(timezone)) {
        momentValue = moment.tz(value, timezone);
    } else {
        momentValue = moment(value);
    }

    return momentValue.isValid() ? momentValue : null;
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
        return momentValue.utc().format(RFC3339_DATETIME_FORMAT);
    }

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
        // Handle dynamic patterns like "+5d", "+2w", "+1m", "+3h"
        const dynamicMatch = dateStr.match(/^([+-]\d{1,4})([dwmh])$/i);
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
            case 'h':
                momentUnit = 'hour';
                return now.add(value, momentUnit);
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
        return relativeMoment.format('YYYY-MM-DD');
    }

    return dateStr;
}

