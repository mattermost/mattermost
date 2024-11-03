// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {memo, useCallback, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {GlobalState} from '@mattermost/types/store';

import {
    TrackPropertyUser, TrackPropertyUserAgent,
    TrackScheduledPostsFeature,
} from 'mattermost-redux/constants/telemetry';
import {get as getPreference} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {trackFeatureEvent} from 'actions/telemetry_actions';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import * as Menu from 'components/menu';
import type {Props as MenuItemProps} from 'components/menu/menu_item';
import Timestamp from 'components/timestamp';

import {scheduledPosts} from 'utils/constants';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    channelId: string;
}

function CoreMenuOptions({handleOnSelect, channelId}: Props) {
    const {
        userCurrentTimezone,
        teammateTimezone,
        teammateDisplayName,
        isDM,
    } = useTimePostBoxIndicator(channelId);

    const currentUserId = useSelector(getCurrentUserId);

    useEffect(() => {
        // tracking opening of scheduled posts option menu.
        // Since MUI menu has no `onOpen` event, we are tracking it here.
        // useEffect ensures that it is tracked only once.
        trackFeatureEvent(
            TrackScheduledPostsFeature,
            'scheduled_posts_menu_opened',
            {
                [TrackPropertyUser]: currentUserId,
                [TrackPropertyUserAgent]: 'webapp',
            },
        );
    }, [currentUserId]);
    const recentlyUsedCustomDate = useSelector((state: GlobalState) => getPreference(state, scheduledPosts.SCHEDULED_POSTS, scheduledPosts.RECENTLY_USED_CUSTOM_TIME));
    interface RecentlyUsedCustomDate {
        update_at?: number;
        timestamp?: number;
    }

    let recentlyUsedCustomDateVal: RecentlyUsedCustomDate = {};

    if (recentlyUsedCustomDate) {
        try {
            recentlyUsedCustomDateVal = JSON.parse(recentlyUsedCustomDate) as RecentlyUsedCustomDate;
        } catch (e) {
            recentlyUsedCustomDateVal = {};
        }
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

    let recentCustomTime = null;
    if (
        recentlyUsedCustomDateVal &&
        typeof recentlyUsedCustomDateVal.update_at === 'number' &&
        typeof recentlyUsedCustomDateVal.timestamp === 'number' &&
        isTimestampWithinLast30Days(recentlyUsedCustomDateVal.update_at, userCurrentTimezone)
    ) {
        const handleRecentlyUsedCustomTime = useCallback((e) => handleOnSelect(e, recentlyUsedCustomDateVal.timestamp!), [handleOnSelect, recentlyUsedCustomDateVal.timestamp]);

        const timestamp = useMemo(() => (
            <Timestamp
                value={recentlyUsedCustomDateVal.timestamp}
                timeZone={userCurrentTimezone}
                useRelative={false}
                useDate={{weekday: 'long'}}
                useTime={{hour: 'numeric', minute: 'numeric'}}
            />
        ), [recentlyUsedCustomDateVal.timestamp, userCurrentTimezone]);

        recentCustomTime = (
            <>
                <Menu.Separator/>
                <Menu.Item
                    key={'recently_used_custom_time'}
                    onClick={handleRecentlyUsedCustomTime}
                    labels={timestamp}
                    className='core-menu-options'
                    trailingElements={(
                        <FormattedMessage
                            id='create_post_button.option.schedule_message.options.recently_used_custom_time'
                            defaultMessage='Recently used custom time'
                        />
                    )}
                />
            </>
        );
    }

    const now = DateTime.now().setZone(userCurrentTimezone);
    const tomorrow9amTime = DateTime.now().
        setZone(userCurrentTimezone).
        plus({days: 1}).
        set({hour: 9, minute: 0, second: 0, millisecond: 0}).
        toMillis();

    const timeComponent = (
        <Timestamp
            value={tomorrow9amTime.valueOf()}
            useDate={false}
        />
    );

    const extraProps: Partial<MenuItemProps> = {};

    if (isDM) {
        function getScheduledTimeInTeammateTimezone(userCurrentTimestamp: number, teammateTimezoneString: string): string {
            const scheduledTimeUTC = DateTime.fromMillis(userCurrentTimestamp, {zone: 'utc'});
            const teammateScheduledTime = scheduledTimeUTC.setZone(teammateTimezoneString);
            const formattedTime = teammateScheduledTime.toFormat('h:mm a');
            return formattedTime;
        }

        const teammateTimezoneString = teammateTimezone.useAutomaticTimezone ? teammateTimezone.automaticTimezone : teammateTimezone.manualTimezone || 'UTC';
        const scheduledTimeInTeammateTimezone = getScheduledTimeInTeammateTimezone(tomorrow9amTime, teammateTimezoneString);
        const teammateTimeDisplay = (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.teammate_user_hour'
                defaultMessage="{time} {user}'s time"
                values={{
                    user: (
                        <span className='userDisplayName'>
                            {teammateDisplayName}
                        </span>
                    ),
                    time: scheduledTimeInTeammateTimezone,
                }}
            />
        );

        extraProps.trailingElements = teammateTimeDisplay;
    }

    const tomorrowClickHandler = useCallback((e) => handleOnSelect(e, tomorrow9amTime), [handleOnSelect, tomorrow9amTime]);

    const optionTomorrow = (
        <Menu.Item
            key={'scheduling_time_tomorrow_9_am'}
            onClick={tomorrowClickHandler}
            labels={
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.tomorrow'
                    defaultMessage='Tomorrow at {9amTime}'
                    values={{'9amTime': timeComponent}}
                />
            }
            className='core-menu-options'
            {...extraProps}
        />
    );

    function getNextWeekday(dateTime: DateTime, targetWeekday: number) {
        // eslint-disable-next-line no-mixed-operators
        const deltaDays = (targetWeekday - dateTime.weekday + 7) % 7 || 7;
        return dateTime.plus({days: deltaDays});
    }

    const nextMondayDateTime = getNextWeekday(now, 1).set({
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
    });

    const nextMonday = nextMondayDateTime.toMillis();

    const nextMondayClickHandler = useCallback((e) => handleOnSelect(e, nextMonday), [handleOnSelect, nextMonday]);

    const optionNextMonday = (
        <Menu.Item
            key={'scheduling_time_next_monday_9_am'}
            onClick={nextMondayClickHandler}
            labels={
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.next_monday'
                    defaultMessage='Next Monday at {9amTime}'
                    values={{'9amTime': timeComponent}}
                />
            }
            className='core-menu-options'
            {...extraProps}
        />
    );

    const optionMonday = (
        <Menu.Item
            key={'scheduling_time_monday_9_am'}
            onClick={nextMondayClickHandler}
            labels={
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.monday'
                    defaultMessage='Monday at {9amTime}'
                    values={{
                        '9amTime': timeComponent,
                    }}
                />
            }
            className='core-menu-options'
            {...extraProps}
        />
    );

    let options: React.ReactElement[] = [];

    switch (now.weekday) {
    // Sunday
    case 7:
        options = [optionTomorrow];
        break;

        // Monday
    case 1:
        options = [optionTomorrow, optionNextMonday];
        break;

        // Friday and Saturday
    case 5:
    case 6:
        options = [optionMonday];
        break;

        // Tuesday to Thursday
    default:
        options = [optionTomorrow, optionMonday];
    }

    return (
        <div className='options'>
            {recentCustomTime ? [...options, recentCustomTime] : options}
        </div>
    );
}

export default memo(CoreMenuOptions);
