// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment-timezone';

import type {UserProfile} from '@mattermost/types/users';

import {DATE_LINE} from 'mattermost-redux/utils/post_list';
import {getUserCurrentTimezone} from 'mattermost-redux/utils/timezone_utils';

import type {PlatformNotificationRecord} from 'types/store/rhs';

import {getPlatformNotificationTimestamp} from './platform_notification_unread';

export type PlatformNotificationListItem = string | PlatformNotificationRecord;

function getAdjustedDateForTimezone(timestamp: number, currentUser?: UserProfile | null): Date {
    const postDate = new Date(timestamp);
    const currentOffset = postDate.getTimezoneOffset() * 60 * 1000;
    const timezone = currentUser ? getUserCurrentTimezone(currentUser.timezone) : '';
    if (timezone) {
        const zone = moment.tz.zone(timezone);
        if (zone) {
            const timezoneOffset = zone.utcOffset(postDate.getTime()) * 60 * 1000;
            postDate.setTime(postDate.getTime() + (currentOffset - timezoneOffset));
        }
    }

    return postDate;
}

export function addDateSeparatorsForPlatformNotifications(
    notifications: PlatformNotificationRecord[],
    posts: Record<string, {create_at?: number}>,
    currentUser?: UserProfile | null,
): PlatformNotificationListItem[] {
    const out: PlatformNotificationListItem[] = [];
    let lastDate: Date | undefined;

    for (const record of notifications) {
        const timestamp = getPlatformNotificationTimestamp(record, posts[record.postId]);
        const postDate = getAdjustedDateForTimezone(timestamp, currentUser);

        if (!lastDate || lastDate.toDateString() !== postDate.toDateString()) {
            out.push(DATE_LINE + postDate.getTime());
            lastDate = postDate;
        }

        out.push(record);
    }

    return out;
}
