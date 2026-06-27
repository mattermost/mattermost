// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {memo, useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    getNextMonday9amTimestamp,
    getToday9amTimestamp,
    getTomorrow9amTimestamp,
    isOneToOneDmChannel,
    shouldShowToday9amPreset,
} from 'components/advanced_text_editor/send_button/schedule_message_utils';
import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import * as Menu from 'components/menu';
import Timestamp from 'components/timestamp';

import type {GlobalState} from 'types/store';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    channelId: string;
    useRecipientTimezone?: boolean;
};

const USE_TIME_HOUR_MINUTE_NUMERIC = {hour: 'numeric', minute: 'numeric'} as const;

function ScheduleMenuOptions({handleOnSelect, channelId, useRecipientTimezone = true}: Props) {
    const isDmChannel = useSelector((state: GlobalState) => isOneToOneDmChannel(state, channelId));
    const {
        userCurrentTimezone,
        recipientTimezoneString,
        teammateDisplayName,
    } = useTimePostBoxIndicator(channelId);

    if (isDmChannel) {
        return (
            <DmSchedulePresets
                handleOnSelect={handleOnSelect}
                userCurrentTimezone={userCurrentTimezone}
                recipientTimezoneString={recipientTimezoneString}
                teammateDisplayName={teammateDisplayName}
                useRecipientTimezone={useRecipientTimezone}
            />
        );
    }

    return (
        <ChannelSchedulePresets
            handleOnSelect={handleOnSelect}
            userCurrentTimezone={userCurrentTimezone}
        />
    );
}

type DmSchedulePresetsProps = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    userCurrentTimezone: string;
    recipientTimezoneString: string;
    teammateDisplayName: string;
    useRecipientTimezone: boolean;
};

function DmSchedulePresets({
    handleOnSelect,
    userCurrentTimezone,
    recipientTimezoneString,
    teammateDisplayName,
    useRecipientTimezone,
}: DmSchedulePresetsProps) {
    const activeTimezone = useRecipientTimezone ? recipientTimezoneString : userCurrentTimezone;
    const conversionTimezone = useRecipientTimezone ? userCurrentTimezone : recipientTimezoneString;

    const now = DateTime.now().setZone(activeTimezone);
    const today9amTime = useMemo(
        () => getToday9amTimestamp(activeTimezone),
        [activeTimezone],
    );
    const tomorrow9amTime = useMemo(
        () => getTomorrow9amTimestamp(activeTimezone),
        [activeTimezone],
    );
    const nextMonday = useMemo(
        () => getNextMonday9amTimestamp(activeTimezone),
        [activeTimezone],
    );

    const renderConversionSubtitle = useCallback((timestamp: number) => {
        const timeLabel = (
            <Timestamp
                value={timestamp}
                timeZone={conversionTimezone}
                useDate={false}
                useTime={USE_TIME_HOUR_MINUTE_NUMERIC}
            />
        );

        if (useRecipientTimezone) {
            return (
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.conversion_your_time'
                    defaultMessage='{time} your time'
                    values={{time: timeLabel}}
                />
            );
        }

        return (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.conversion_recipient_time'
                defaultMessage="{time} {recipientName}'s time"
                values={{
                    time: timeLabel,
                    recipientName: teammateDisplayName,
                }}
            />
        );
    }, [conversionTimezone, teammateDisplayName, useRecipientTimezone]);

    const renderPresetOption = useCallback((
        key: string,
        testId: string,
        timestamp: number,
        primaryMessage: React.ReactNode,
        autoFocus?: boolean,
    ) => {
        const clickHandler = (e: React.UIEvent) => handleOnSelect(e, timestamp);

        return (
            <Menu.Item
                key={key}
                data-testid={testId}
                onClick={clickHandler}
                labels={
                    <>
                        <span>{primaryMessage}</span>
                        <span>{renderConversionSubtitle(timestamp)}</span>
                    </>
                }
                autoFocus={autoFocus}
            />
        );
    }, [handleOnSelect, renderConversionSubtitle]);

    const timeComponent = (timestamp: number) => (
        <Timestamp
            value={timestamp}
            timeZone={activeTimezone}
            useDate={false}
            useTime={USE_TIME_HOUR_MINUTE_NUMERIC}
        />
    );

    const optionToday = renderPresetOption(
        'scheduling_time_today_9_am',
        'scheduling_time_today_9_am',
        today9amTime,
        (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.today'
                defaultMessage='Today at {9amTime}'
                values={{'9amTime': timeComponent(today9amTime)}}
            />
        ),
        true,
    );

    const optionTomorrow = renderPresetOption(
        'scheduling_time_tomorrow_9_am',
        'scheduling_time_tomorrow_9_am',
        tomorrow9amTime,
        (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.tomorrow'
                defaultMessage='Tomorrow at {9amTime}'
                values={{'9amTime': timeComponent(tomorrow9amTime)}}
            />
        ),
        !shouldShowToday9amPreset(activeTimezone, now),
    );

    const optionNextMonday = renderPresetOption(
        'scheduling_time_next_monday_9_am',
        'scheduling_time_next_monday_9_am',
        nextMonday,
        (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.next_monday'
                defaultMessage='Next Monday at {9amTime}'
                values={{'9amTime': timeComponent(nextMonday)}}
            />
        ),
    );

    const optionMonday = renderPresetOption(
        'scheduling_time_monday_9_am',
        'scheduling_time_monday_9_am',
        nextMonday,
        (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.monday'
                defaultMessage='Monday at {9amTime}'
                values={{'9amTime': timeComponent(nextMonday)}}
            />
        ),
        now.weekday === 5 || now.weekday === 6,
    );

    let options: React.ReactElement[] = [];

    if (shouldShowToday9amPreset(activeTimezone, now)) {
        options = [optionToday, optionTomorrow];
    } else {
        switch (now.weekday) {
        case 7:
            options = [optionTomorrow];
            break;
        case 1:
            options = [optionTomorrow, optionNextMonday];
            break;
        case 5:
        case 6:
            options = [optionMonday];
            break;
        default:
            options = [optionTomorrow, optionMonday];
        }
    }

    return <>{options}</>;
}

type ChannelSchedulePresetsProps = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    userCurrentTimezone: string;
};

function ChannelSchedulePresets({handleOnSelect, userCurrentTimezone}: ChannelSchedulePresetsProps) {
    const now = DateTime.now().setZone(userCurrentTimezone);
    const tomorrow9amTime = getTomorrow9amTimestamp(userCurrentTimezone);
    const nextMonday = getNextMonday9amTimestamp(userCurrentTimezone);

    const timeComponent = (
        <Timestamp
            value={tomorrow9amTime.valueOf()}
            useDate={false}
        />
    );

    const tomorrowClickHandler = useCallback((e: React.UIEvent) => handleOnSelect(e, tomorrow9amTime), [handleOnSelect, tomorrow9amTime]);

    const optionTomorrow = (
        <Menu.Item
            key={'scheduling_time_tomorrow_9_am'}
            data-testid='scheduling_time_tomorrow_9_am'
            onClick={tomorrowClickHandler}
            labels={
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.tomorrow'
                    defaultMessage='Tomorrow at {9amTime}'
                    values={{'9amTime': timeComponent}}
                />
            }
            autoFocus={true}
        />
    );

    const nextMondayClickHandler = useCallback((e: React.UIEvent) => handleOnSelect(e, nextMonday), [handleOnSelect, nextMonday]);

    const optionNextMonday = (
        <Menu.Item
            key={'scheduling_time_next_monday_9_am'}
            data-testid='scheduling_time_next_monday_9_am'
            onClick={nextMondayClickHandler}
            labels={
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.next_monday'
                    defaultMessage='Next Monday at {9amTime}'
                    values={{'9amTime': timeComponent}}
                />
            }
        />
    );

    const optionMonday = (
        <Menu.Item
            key={'scheduling_time_monday_9_am'}
            data-testid='scheduling_time_monday_9_am'
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
            autoFocus={now.weekday === 5 || now.weekday === 6}
        />
    );

    let options: React.ReactElement[] = [];

    switch (now.weekday) {
    case 7:
        options = [optionTomorrow];
        break;
    case 1:
        options = [optionTomorrow, optionNextMonday];
        break;
    case 5:
    case 6:
        options = [optionMonday];
        break;
    default:
        options = [optionTomorrow, optionMonday];
    }

    return <>{options}</>;
}

export default memo(ScheduleMenuOptions);
