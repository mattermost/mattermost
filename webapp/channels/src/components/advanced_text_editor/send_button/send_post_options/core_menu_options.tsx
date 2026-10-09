// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentLocale} from 'selectors/i18n';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import * as Menu from 'components/menu';
import Timestamp from 'components/timestamp';

import RecentUsedCustomDate from './recent_used_custom_date';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    channelId: string;

    // When true, the preset times are picked in the DM recipient's timezone instead of the current user's.
    isUsingRecipientTimezone?: boolean;
};

/**
 * Formats a timestamp in the given timezone using the current user's locale.
 * @param timestamp - Timestamp in milliseconds (UTC)
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @param userLocale - User's locale code (e.g., "fr", "en", "de")
 * @returns Formatted time string respecting the user's locale
 * @example
 * // US locale: "8:00 AM"
 * // French locale: "08:00"
 * getTimeInTimezone(1635768000000, 'Europe/Paris', 'fr')
 */
function getTimeInTimezone(timestamp: number, timezone: string, userLocale: string): string {
    return DateTime.fromMillis(timestamp, {zone: 'utc'}).
        setZone(timezone).
        setLocale(userLocale).
        toLocaleString(DateTime.TIME_SIMPLE);
}

function getNextWeekday(dateTime: DateTime, targetWeekday: number) {
    const daysDifference = targetWeekday - dateTime.weekday;
    const adjustedDays = (daysDifference + 7) % 7;
    const deltaDays = adjustedDays === 0 ? 7 : adjustedDays;
    return dateTime.plus({days: deltaDays});
}

const NINE_AM = {hour: 9, minute: 0, second: 0, millisecond: 0};

function CoreMenuOptions({handleOnSelect, channelId, isUsingRecipientTimezone = false}: Props) {
    const {
        userCurrentTimezone,
        teammateTimezone,
        teammateDisplayName,
        isDM,
        isSelfDM,
        isBot,
    } = useTimePostBoxIndicator(channelId);

    const locale = useSelector(getCurrentLocale);

    const showTeammateTime = isDM && !isBot && !isSelfDM;
    const teammateTimezoneString = (teammateTimezone.useAutomaticTimezone ? teammateTimezone.automaticTimezone : teammateTimezone.manualTimezone) || 'UTC';
    const useTeammateTimezone = showTeammateTime && isUsingRecipientTimezone;
    const schedulingTimezone = useTeammateTimezone ? teammateTimezoneString : userCurrentTimezone;

    const now = DateTime.now().setZone(schedulingTimezone);
    const today9am = now.set(NINE_AM);
    const today9amTime = today9am.toMillis();
    const tomorrow9amTime = now.plus({days: 1}).set(NINE_AM).toMillis();
    const nextMonday = getNextWeekday(now, 1).set(NINE_AM).toMillis();

    // Offer "Today at 9:00 AM" on weekdays until 9 AM has passed
    const showToday = now < today9am && now.weekday <= 5;

    const getTrailingElements = (timestamp: number) => {
        if (useTeammateTimezone) {
            return (
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.your_time'
                    defaultMessage='{time} your time'
                    values={{
                        time: getTimeInTimezone(timestamp, userCurrentTimezone, locale),
                    }}
                />
            );
        }

        if (showTeammateTime) {
            return (
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.teammate_user_hour'
                    defaultMessage='{time} {user}’s time'
                    values={{
                        user: (
                            <span className='userDisplayName'>
                                {teammateDisplayName}
                            </span>
                        ),
                        time: getTimeInTimezone(timestamp, teammateTimezoneString, locale),
                    }}
                />
            );
        }

        return undefined;
    };

    const todayClickHandler = useCallback((e: React.UIEvent) => handleOnSelect(e, today9amTime), [handleOnSelect, today9amTime]);
    const tomorrowClickHandler = useCallback((e: React.UIEvent) => handleOnSelect(e, tomorrow9amTime), [handleOnSelect, tomorrow9amTime]);
    const nextMondayClickHandler = useCallback((e: React.UIEvent) => handleOnSelect(e, nextMonday), [handleOnSelect, nextMonday]);

    const makeOption = (key: string, timestamp: number, onClick: (e: React.UIEvent) => void, label: React.ReactElement, autoFocus: boolean) => (
        <Menu.Item
            key={key}
            data-testid={key}
            onClick={onClick}
            labels={label}
            className='core-menu-options'
            autoFocus={autoFocus}
            trailingElements={getTrailingElements(timestamp)}
        />
    );

    const timeComponent = (timestamp: number) => (
        <Timestamp
            value={timestamp}
            useDate={false}
            timeZone={schedulingTimezone}
        />
    );

    const optionToday = (autoFocus: boolean) => makeOption(
        'scheduling_time_today_9_am',
        today9amTime,
        todayClickHandler,
        (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.today'
                defaultMessage='Today at {9amTime}'
                values={{'9amTime': timeComponent(today9amTime)}}
            />
        ),
        autoFocus,
    );

    const optionTomorrow = (autoFocus: boolean) => makeOption(
        'scheduling_time_tomorrow_9_am',
        tomorrow9amTime,
        tomorrowClickHandler,
        (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.tomorrow'
                defaultMessage='Tomorrow at {9amTime}'
                values={{'9amTime': timeComponent(tomorrow9amTime)}}
            />
        ),
        autoFocus,
    );

    const optionNextMonday = (autoFocus: boolean) => makeOption(
        'scheduling_time_next_monday_9_am',
        nextMonday,
        nextMondayClickHandler,
        (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.next_monday'
                defaultMessage='Next Monday at {9amTime}'
                values={{'9amTime': timeComponent(nextMonday)}}
            />
        ),
        autoFocus,
    );

    const optionMonday = (autoFocus: boolean) => makeOption(
        'scheduling_time_monday_9_am',
        nextMonday,
        nextMondayClickHandler,
        (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.monday'
                defaultMessage='Monday at {9amTime}'
                values={{'9amTime': timeComponent(nextMonday)}}
            />
        ),
        autoFocus,
    );

    let options: Array<(autoFocus: boolean) => React.ReactElement> = [];

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

    if (showToday) {
        options = [optionToday, options[0]];
    }

    return (
        <>
            {options.map((option, index) => option(index === 0))}
            <RecentUsedCustomDate
                handleOnSelect={handleOnSelect}
                userCurrentTimezone={schedulingTimezone}
                today9amTime={showToday ? today9amTime : undefined}
                tomorrow9amTime={tomorrow9amTime}
                nextMonday={nextMonday}
            />
        </>
    );
}

export default memo(CoreMenuOptions);
