// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Zone} from 'luxon';
import {DateTime} from 'luxon';
import React, {memo, useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';

import {
    getNextMonday9amTimestamp,
    getTomorrow9amTimestamp,
} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import * as Menu from 'components/menu';
import Timestamp, {RelativeRanges} from 'components/timestamp';

import {scheduledPosts} from 'utils/constants';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    userCurrentTimezone: string;
    channelId: string;
    isDmRedesign?: boolean;
    recipientTimezoneString?: string;
    useRecipientTimezone?: boolean;
    recipientDisplayName?: string;
}

const DATE_RANGES = [
    RelativeRanges.TODAY_TITLE_CASE,
    RelativeRanges.TOMORROW_TITLE_CASE,
];

const USE_TIME_HOUR_MINUTE_NUMERIC = {hour: 'numeric', minute: 'numeric'} as const;
const USE_DATE_WEEKDAY_LONG = {weekday: 'long'} as const;
const USE_DATE_MONTH_DAY = {month: 'long', day: 'numeric'} as const;

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
    useRecipientTimezone = true,
    recipientDisplayName = '',
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

    const activeTimezone = isDmRedesign && recipientTimezoneString && useRecipientTimezone ?
        recipientTimezoneString :
        userCurrentTimezone;

    const conversionTimezone = useMemo(() => {
        if (!isDmRedesign || !recipientTimezoneString || useRecipientTimezone) {
            return userCurrentTimezone;
        }

        return recipientTimezoneString;
    }, [isDmRedesign, recipientTimezoneString, useRecipientTimezone, userCurrentTimezone]);

    const excludedTimestamps = useMemo(() => {
        if (isDmRedesign && recipientTimezoneString) {
            return [
                getTomorrow9amTimestamp(activeTimezone),
                getNextMonday9amTimestamp(activeTimezone),
            ];
        }

        return [
            getTomorrow9amTimestamp(userCurrentTimezone),
            getNextMonday9amTimestamp(userCurrentTimezone),
        ];
    }, [activeTimezone, isDmRedesign, recipientTimezoneString, userCurrentTimezone]);

    const handleRecentlyUsedCustomTime = useCallback(
        (e: React.UIEvent) => handleOnSelect(e, recentlyUsedCustomDateVal.timestamp!),
        [handleOnSelect, recentlyUsedCustomDateVal.timestamp],
    );

    if (
        !shouldShowRecentlyUsedCustomTime(now.toMillis(), recentlyUsedCustomDateVal, userCurrentTimezone, excludedTimestamps)
    ) {
        return null;
    }

    const dateOption = getDateOption(now, recentlyUsedCustomDateVal.timestamp, activeTimezone);

    if (isDmRedesign) {
        const timeOnly = (
            <Timestamp
                ranges={DATE_RANGES}
                value={recentlyUsedCustomDateVal.timestamp}
                timeZone={activeTimezone}
                useDate={false}
                useTime={USE_TIME_HOUR_MINUTE_NUMERIC}
            />
        );

        const dayLabel = (
            <Timestamp
                ranges={DATE_RANGES}
                value={recentlyUsedCustomDateVal.timestamp}
                timeZone={activeTimezone}
                useDate={dateOption}
                useTime={false}
            />
        );

        const conversionTime = (
            <Timestamp
                value={recentlyUsedCustomDateVal.timestamp}
                timeZone={conversionTimezone}
                useDate={false}
                useTime={USE_TIME_HOUR_MINUTE_NUMERIC}
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
                                {useRecipientTimezone ? (
                                    <FormattedMessage
                                        id='create_post_button.option.schedule_message.options.conversion_your_time'
                                        defaultMessage='{time} your time'
                                        values={{time: conversionTime}}
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='create_post_button.option.schedule_message.options.conversion_recipient_time'
                                        defaultMessage="{time} {recipientName}'s time"
                                        values={{
                                            time: conversionTime,
                                            recipientName: recipientDisplayName,
                                        }}
                                    />
                                )}
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
