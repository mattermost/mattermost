// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import type {Moment} from 'moment-timezone';
import moment from 'moment-timezone';

import type {UserProfile, UserTimezone} from '@mattermost/types/users';

import {getDirectChannel} from 'mattermost-redux/selectors/entities/channels';
import {generateCurrentTimezoneLabel} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import type {GlobalState} from 'types/store';

export type SchedulePerspective = 'mine' | 'theirs';

export function useRecipientTimezoneToPerspective(useRecipientTimezone: boolean): SchedulePerspective {
    return useRecipientTimezone ? 'theirs' : 'mine';
}

export function getNextWeekday(dateTime: DateTime, targetWeekday: number): DateTime {
    const daysDifference = targetWeekday - dateTime.weekday;
    const adjustedDays = (daysDifference + 7) % 7;
    const deltaDays = adjustedDays === 0 ? 7 : adjustedDays;
    return dateTime.plus({days: deltaDays});
}

export function getToday9amTimestamp(timezone: string, now?: DateTime): number {
    return (now || DateTime.now()).
        setZone(timezone).
        set({hour: 9, minute: 0, second: 0, millisecond: 0}).
        toMillis();
}

export function getTomorrow9amTimestamp(timezone: string): number {
    return DateTime.now().
        setZone(timezone).
        plus({days: 1}).
        set({hour: 9, minute: 0, second: 0, millisecond: 0}).
        toMillis();
}

export function shouldShowToday9amPreset(timezone: string, now?: DateTime): boolean {
    const dateTime = (now || DateTime.now()).setZone(timezone);
    const isWeekday = dateTime.weekday >= 1 && dateTime.weekday <= 5;

    return isWeekday && dateTime.hour < 9;
}

export function getNextMonday9amTimestamp(timezone: string): number {
    const now = DateTime.now().setZone(timezone);
    return getNextWeekday(now, 1).set({
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
    }).toMillis();
}

export function hasRecipientTimezone(teammate?: UserProfile): boolean {
    if (!teammate?.timezone) {
        return false;
    }

    const {
        useAutomaticTimezone,
        automaticTimezone,
        manualTimezone,
    } = teammate.timezone;

    let useAutomatic = useAutomaticTimezone;
    if (typeof useAutomaticTimezone === 'string') {
        useAutomatic = useAutomaticTimezone === 'true';
    }

    const zone = useAutomatic ? automaticTimezone : manualTimezone;
    return Boolean(zone?.trim());
}

export function getRecipientTimezoneString(teammateTimezone: UserTimezone): string {
    return getUserCurrentTimezone(teammateTimezone);
}

export function getTheirMorningTimestamp(recipientTz: string, now?: DateTime): number {
    const nowTheir = (now || DateTime.now()).setZone(recipientTz);
    const isWeekday = nowTheir.weekday >= 1 && nowTheir.weekday <= 5;

    if (isWeekday && nowTheir.hour < 9) {
        return nowTheir.set({hour: 9, minute: 0, second: 0, millisecond: 0}).toMillis();
    }

    let candidate = nowTheir.plus({days: 1}).startOf('day');
    while (candidate.weekday < 1 || candidate.weekday > 5) {
        candidate = candidate.plus({days: 1});
    }

    return candidate.set({hour: 9, minute: 0, second: 0, millisecond: 0}).toMillis();
}

export function getRecipientLocationLabel(teammate: UserProfile | undefined, recipientTz: string): string {
    const position = teammate?.position?.trim();
    if (position) {
        return position;
    }

    return generateCurrentTimezoneLabel(recipientTz);
}

export function formatTimezoneOffsetShort(timezone: string, at?: Moment): string {
    const m = at ? moment(at).tz(timezone) : moment.tz(timezone);
    const offsetMinutes = m.utcOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;

    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');

    return `UTC${sign}${paddedHours}:${paddedMinutes}`;
}

export function reinterpretWallClock(dateTime: Moment, newTimezone: string): Moment {
    return moment.tz({
        year: dateTime.year(),
        month: dateTime.month(),
        date: dateTime.date(),
        hour: dateTime.hour(),
        minute: dateTime.minute(),
        second: 0,
        millisecond: 0,
    }, newTimezone);
}

export function isDmScheduleRedesign(state: GlobalState, channelId: string): boolean {
    const channel = getDirectChannel(state, channelId);
    if (!channel?.teammate_id) {
        return false;
    }

    const currentUserId = getCurrentUserId(state);
    const teammate = getUser(state, channel.teammate_id);

    if (!teammate || teammate.is_bot) {
        return false;
    }

    if (channel.teammate_id === currentUserId) {
        return false;
    }

    return hasRecipientTimezone(teammate);
}

export function getDefaultScheduleDateTime(
    perspective: SchedulePerspective,
    senderTimezone: string,
    recipientTimezone: string,
): Moment {
    const activeTimezone = perspective === 'theirs' ? recipientTimezone : senderTimezone;
    return moment.tz(activeTimezone).add(1, 'days').set({
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
    });
}
