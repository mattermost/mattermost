// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import {useCallback, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getDirectChannel} from 'mattermost-redux/selectors/entities/channels';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import {scheduledPosts} from 'utils/constants';

import type {GlobalState} from 'types/store';

/**
 * Formats the current UTC offset of a timezone, e.g. "UTC-04:00".
 */
export function formatUTCOffset(timezone: string): string {
    return DateTime.now().setZone(timezone).toFormat("'UTC'ZZ");
}

const DAYS_TO_COMPARE = 366;
const timezonesDifferCache = new Map<string, boolean>();

/**
 * Whether two timezones show a different time on any day within the next year.
 *
 * Differently named zones can share a clock all year (e.g. America/New_York and America/Toronto),
 * while zones with the same offset today can still diverge once only one of them changes its
 * clocks for daylight saving, which matters for messages scheduled further ahead.
 */
export function timezonesDiffer(timezoneA: string, timezoneB: string): boolean {
    if (timezoneA === timezoneB) {
        return false;
    }

    const start = DateTime.utc().startOf('day');
    const key = `${timezoneA}|${timezoneB}|${start.toISODate()}`;
    const cached = timezonesDifferCache.get(key);
    if (cached !== undefined) {
        return cached;
    }

    let differ = false;
    if (start.setZone(timezoneA).isValid && start.setZone(timezoneB).isValid) {
        for (let day = 0; day < DAYS_TO_COMPARE && !differ; day++) {
            const date = start.plus({days: day});
            differ = date.setZone(timezoneA).offset !== date.setZone(timezoneB).offset;
        }
    }

    timezonesDifferCache.set(key, differ);
    return differ;
}

/**
 * Lets the user schedule a message in a DM using the recipient's timezone instead of their own.
 * The choice is stored as a preference so it is shared by the schedule menu and the custom time modal.
 */
export default function useRecipientTimezone(channelId: string) {
    const dispatch = useDispatch();

    const currentUserId = useSelector(getCurrentUserId);
    const userTimezone = useSelector(getCurrentTimezone);
    const teammateId = useSelector((state: GlobalState) => getDirectChannel(state, channelId)?.teammate_id || '');
    const teammate = useSelector((state: GlobalState) => (teammateId ? getUser(state, teammateId) : undefined));
    const enabled = useSelector((state: GlobalState) => getBool(state, scheduledPosts.SCHEDULED_POSTS, scheduledPosts.USE_RECIPIENT_TIMEZONE, false));

    const recipientTimezone = teammate?.timezone ? getUserCurrentTimezone(teammate.timezone) : '';

    // Only offer the option when it would actually change the scheduled time.
    const canUseRecipientTimezone = useMemo(() => {
        if (!teammate || teammate.is_bot || teammate.id === currentUserId || !recipientTimezone) {
            return false;
        }

        return timezonesDiffer(recipientTimezone, userTimezone);
    }, [teammate, currentUserId, recipientTimezone, userTimezone]);

    const isUsingRecipientTimezone = canUseRecipientTimezone && enabled;

    const setUseRecipientTimezone = useCallback((value: boolean) => {
        dispatch(savePreferences(currentUserId, [{
            user_id: currentUserId,
            category: scheduledPosts.SCHEDULED_POSTS,
            name: scheduledPosts.USE_RECIPIENT_TIMEZONE,
            value: String(value),
        }]));
    }, [dispatch, currentUserId]);

    return {
        canUseRecipientTimezone,
        isUsingRecipientTimezone,
        setUseRecipientTimezone,
        recipientTimezone,
        userTimezone,

        // The timezone that scheduling options should be picked in
        schedulingTimezone: isUsingRecipientTimezone ? recipientTimezone : userTimezone,
    };
}
