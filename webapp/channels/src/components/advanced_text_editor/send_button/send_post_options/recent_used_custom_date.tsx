// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Zone} from 'luxon';
import {DateTime} from 'luxon';
import React, {memo, useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';

import {getTheirMorningTimestamp} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import * as Menu from 'components/menu';
import Timestamp, {RelativeRanges} from 'components/timestamp';

import {scheduledPosts} from 'utils/constants';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    userCurrentTimezone: string;
    channelId: string;
    isDmRedesign?: boolean;
    recipientTimezoneString?: string;
}

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.TOMORROW_TITLE_CASE,
];

interface RecentlyUsedCustomDate {
    update_at?: number;
    timestamp?: number;
}

function isTimestampWithinLast30Days(timestamp: number, timeZone = 'UTC') {
    if (!timestamp || isNaN(timestamp)) {
        return false;
    }
    const usedDate = DateTime.fromMillis(timestamp).setZone(timeZone);
    const now = DateTime.now().setZone(timeZone);
    const thirtyDaysAgo = now.minus({days: 30});

    return usedDate >= thirtyDaysAgo && usedDate <= now;
}

function shouldShowRecentlyUsedCustomTime(
    nowMillis: number,
    recentlyUsedCustomDateVal: RecentlyUsedCustomDate,
    userCurrentTimezone: string,
    excludedTimestamps: number[],
) {
    return recentlyUsedCustomDateVal &&
    typeof recentlyUsedCustomDateVal.update_at === 'number' &&
    typeof recentlyUsedCustomDateVal.timestamp === 'number' &&
    recentlyUsedCustomDateVal.timestamp > nowMillis &&
    !excludedTimestamps.includes(recentlyUsedCustomDateVal.timestamp) &&
    isTimestampWithinLast30Days(recentlyUsedCustomDateVal.update_at, userCurrentTimezone);
}

const USE_DATE_WEEKDAY_LONG = {weekday: 'long'} as const;
const USE_TIME_HOUR_MINUTE_NUMERIC = {hour: 'numeric', minute: 'numeric'} as const;
const USE_DATE_MONTH_DAY = {month: 'long', day: 'numeric'} as const;

function getDateOption(now: DateTime, timestamp: number | undefined, userCurrentTimezone: string | Zone | undefined) {
    if (!now || !timestamp || !userCurrentTimezone) {
        return USE_DATE_WEEKDAY_LONG;
    }
    const scheduledDate = DateTime.fromMillis(timestamp).setZone(userCurrentTimezone);
    const isInCurrentWeek = scheduledDate.weekNumber === now.weekNumber && scheduledDate.weekYear === now.weekYear;
    return isInCurrentWeek ? USE_DATE_WEEKDAY_LONG : USE_DATE_MONTH_DAY;
}

function RecentUsedCustomDate({
    handleOnSelect,
    userCurrentTimezone,
    isDmRedesign,
    recipientTimezoneString,
}: Props) {
    const now = DateTime.now().setZone(userCurrentTimezone);
    const recentlyUsedCustomDate = useSelector((state: GlobalState) => getPreference(state, scheduledPosts.SCHEDULED_POSTS, scheduledPosts.RECENTLY_USED_CUSTOM_TIME));
    const recentlyUsedCustomDateVal: RecentlyUsedCustomDate = useMemo(() => {
        if (recentlyUsedCustomDate) {
            try {
                return JSON.parse(recentlyUsedCustomDate) as RecentlyUsedCustomDate;
            } catch (e) {
                return {};
            }
        }
        return {};
    }, [recentlyUsedCustomDate]);

    const excludedTimestamps = useMemo(() => {
        if (isDmRedesign && recipientTimezoneString) {
            return [getTheirMorningTimestamp(recipientTimezoneString)];
        }

        const tomorrow9amTime = DateTime.now().
            setZone(userCurrentTimezone).
            plus({days: 1}).
            set({hour: 9, minute: 0, second: 0, millisecond: 0}).
            toMillis();

        const nextMonday = (() => {
            const nowDt = DateTime.now().setZone(userCurrentTimezone);
            const daysDifference = 1 - nowDt.weekday;
            const adjustedDays = (daysDifference + 7) % 7;
            const deltaDays = adjustedDays === 0 ? 7 : adjustedDays;
            return nowDt.plus({days: deltaDays}).set({
                hour: 9,
                minute: 0,
                second: 0,
                millisecond: 0,
            }).toMillis();
        })();

        return [tomorrow9amTime, nextMonday];
    }, [isDmRedesign, recipientTimezoneString, userCurrentTimezone]);

    const handleRecentlyUsedCustomTime = useCallback(
        (e: React.UIEvent) => handleOnSelect(e, recentlyUsedCustomDateVal.timestamp!),
        [handleOnSelect, recentlyUsedCustomDateVal.timestamp],
    );

    if (
        !shouldShowRecentlyUsedCustomTime(now.toMillis(), recentlyUsedCustomDateVal, userCurrentTimezone, excludedTimestamps)
    ) {
        return null;
    }

    const dateOption = getDateOption(now, recentlyUsedCustomDateVal.timestamp, userCurrentTimezone);

    if (isDmRedesign) {
        const timeOnly = (
            <Timestamp
                ranges={DATE_RANGES}
                value={recentlyUsedCustomDateVal.timestamp}
                timeZone={userCurrentTimezone}
                useDate={false}
                useTime={USE_TIME_HOUR_MINUTE_NUMERIC}
            />
        );

        const dayLabel = (
            <Timestamp
                ranges={DATE_RANGES}
                value={recentlyUsedCustomDateVal.timestamp}
                timeZone={userCurrentTimezone}
                useDate={dateOption}
                useTime={false}
            />
        );

        return (
            <>
                <Menu.Separator key='recent_custom_separator'/>
                <Menu.Item
                    key='recently_used_custom_time'
                    data-testid='recently_used_custom_time'
                    onClick={handleRecentlyUsedCustomTime}
                    labels={
                        <>
                            <span>
                                <FormattedMessage
                                    id='create_post_button.option.schedule_message.options.recently_used_dm.primary'
                                    defaultMessage='{day} at {time}'
                                    values={{
                                        day: dayLabel,
                                        time: timeOnly,
                                    }}
                                />
                            </span>
                            <span className='secondary-label'>
                                <FormattedMessage
                                    id='create_post_button.option.schedule_message.options.recently_used_dm.subtitle'
                                    defaultMessage='Your time · recently used'
                                />
                            </span>
                        </>
                    }
                    className='core-menu-options dm-menu-options'
                />
            </>
        );
    }

    const timestamp = (
        <Timestamp
            ranges={DATE_RANGES}
            value={recentlyUsedCustomDateVal.timestamp}
            timeZone={userCurrentTimezone}
            useDate={dateOption}
            useTime={USE_TIME_HOUR_MINUTE_NUMERIC}
        />
    );

    const trailingElement = (
        <FormattedMessage
            id='create_post_button.option.schedule_message.options.recently_used_custom_time'
            defaultMessage='Recently used custom time'
        />
    );

    return (
        <>
            <Menu.Separator key='recent_custom_separator'/>
            <Menu.Item
                key='recently_used_custom_time'
                data-testid='recently_used_custom_time'
                onClick={handleRecentlyUsedCustomTime}
                labels={timestamp}
                className='core-menu-options'
                trailingElements={trailingElement}
            />
        </>
    );
}

export default memo(RecentUsedCustomDate);
