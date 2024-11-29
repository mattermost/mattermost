// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
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

export function isBeforeTime(dateTime1: Moment, dateTime2: Moment) {
    const a = dateTime1.clone().set({year: 0, month: 0, date: 1});
    const b = dateTime2.clone().set({year: 0, month: 0, date: 1});

    return a.isBefore(b);
}
