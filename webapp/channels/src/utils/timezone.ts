// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

export function getBrowserTimezone() {
    return moment.tz.guess();
}

export function getBrowserUtcOffset() {
    return moment().utcOffset();
}

export function getUtcOffsetForTimeZone(timezone: string) {
    return moment.tz(timezone).utcOffset();
}

export function getCurrentDateForTimezone(timezone: string) {
    const tztime = moment().tz(timezone);
    return new Date(tztime.year(), tztime.month(), tztime.date());
}

export function getCurrentDateTimeForTimezone(timezone: string) {
    const tztime = moment().tz(timezone);
    return new Date(tztime.year(), tztime.month(), tztime.date(), tztime.hour(), tztime.minute(), tztime.second());
}

export function getCurrentMomentForTimezone(timezone?: string) {
    return timezone ? moment.tz(timezone) : moment();
}
