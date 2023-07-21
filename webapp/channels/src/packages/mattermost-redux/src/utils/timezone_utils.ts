// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UserTimezone} from '@mattermost/types/users';
import {Timezone} from 'timezones.json';

export function getUserCurrentTimezone(userTimezone?: UserTimezone): string {
    if (!userTimezone) {
        return 'UTC';
    }
    const {
        useAutomaticTimezone,
        automaticTimezone,
        manualTimezone,
    } = userTimezone;

    let useAutomatic = useAutomaticTimezone;
    if (typeof useAutomaticTimezone === 'string') {
        useAutomatic = useAutomaticTimezone === 'true';
    }

    if (useAutomatic) {
        return automaticTimezone;
    }
    return manualTimezone;
}

export function getTimezoneRegion(timezone: string): string {
    if (timezone) {
        const split = timezone.split('/');
        if (split.length > 1) {
            return split.pop()!.replace(/_/g, ' ');
        }
    }

    return timezone;
}

export function getTimezoneLabel(timezones: Timezone[], timezone: string): string {
    for (let i = 0; i < timezones.length; i++) {
        const zone = timezones[i];
        for (let j = 0; j < zone.utc.length; j++) {
            const utcZone = zone.utc[j];
            if (utcZone.toLowerCase() === timezone.toLowerCase()) {
                return zone.text;
            }
        }
    }
    return timezone;
}

export function getDateForTimezone(date: Date|string, tzString: string): Date {
    return new Date((typeof date === 'string' ? new Date(date) : date).toLocaleString('en-US', {timeZone: tzString}));
}
