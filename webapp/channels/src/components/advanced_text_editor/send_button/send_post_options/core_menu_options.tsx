// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {memo, useCallback, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    TrackPropertyUser, TrackPropertyUserAgent,
    TrackScheduledPostsFeature,
} from 'mattermost-redux/constants/telemetry';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {trackFeatureEvent} from 'actions/telemetry_actions';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import * as Menu from 'components/menu';
import type {Props as MenuItemProps} from 'components/menu/menu_item';
import Timestamp from 'components/timestamp';

import RecentUsedCustomDate from './recent_used_custom_date';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    channelId: string;
}

function getScheduledTimeInTeammateTimezone(userCurrentTimestamp: number, teammateTimezoneString: string): string {
    const scheduledTimeUTC = DateTime.fromMillis(userCurrentTimestamp, {zone: 'utc'});
    const teammateScheduledTime = scheduledTimeUTC.setZone(teammateTimezoneString);
    const formattedTime = teammateScheduledTime.toFormat('h:mm a');
    return formattedTime;
}

function getNextWeekday(dateTime: DateTime, targetWeekday: number) {
    const daysDifference = targetWeekday - dateTime.weekday;
    const adjustedDays = (daysDifference + 7) % 7;
    const deltaDays = adjustedDays === 0 ? 7 : adjustedDays;
    return dateTime.plus({days: deltaDays});
}

function CoreMenuOptions({handleOnSelect, channelId}: Props) {
    const {
        userCurrentTimezone,
        teammateTimezone,
        teammateDisplayName,
        isDM,
        isSelfDM,
        isBot,
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

    const now = DateTime.now().setZone(userCurrentTimezone);
    const tomorrow9amTime = DateTime.now().
        setZone(userCurrentTimezone).
        plus({days: 1}).
        set({hour: 9, minute: 0, second: 0, millisecond: 0}).
        toMillis();

    const nextMonday = getNextWeekday(now, 1).set({
        hour: 9,
        minute: 0,
        second: 0,
        millisecond: 0,
    }).toMillis();

    const timeComponent = (
        <Timestamp
            value={tomorrow9amTime.valueOf()}
            useDate={false}
        />
    );

    const extraProps: Partial<MenuItemProps> = {};

    if (isDM && !isBot && !isSelfDM) {
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
            autoFocus={true}
            {...extraProps}
        />
    );

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
            autoFocus={now.weekday === 5 || now.weekday === 6}
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
        <>
            {options}
            <RecentUsedCustomDate
                handleOnSelect={handleOnSelect}
                userCurrentTimezone={userCurrentTimezone}
                tomorrow9amTime={tomorrow9amTime}
                nextMonday={nextMonday}
            />
        </>
    );
}

export default memo(CoreMenuOptions);
