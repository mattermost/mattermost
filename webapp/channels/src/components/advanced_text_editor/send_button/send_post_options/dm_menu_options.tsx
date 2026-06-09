// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {memo, useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';

import {
    getNextMonday9amTimestamp,
    getTomorrow9amTimestamp,
} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import * as Menu from 'components/menu';
import Timestamp from 'components/timestamp';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    channelId: string;
    useRecipientTimezone: boolean;
}

const USE_TIME_HOUR_MINUTE_NUMERIC = {hour: 'numeric', minute: 'numeric'} as const;

function DmMenuOptions({handleOnSelect, channelId, useRecipientTimezone}: Props) {
    const {
        userCurrentTimezone,
        recipientTimezoneString,
        teammateDisplayName,
    } = useTimePostBoxIndicator(channelId);

    const activeTimezone = useRecipientTimezone ? recipientTimezoneString : userCurrentTimezone;
    const conversionTimezone = useRecipientTimezone ? userCurrentTimezone : recipientTimezoneString;

    const now = DateTime.now().setZone(activeTimezone);
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
                        <span className='secondary-label'>
                            {renderConversionSubtitle(timestamp)}
                        </span>
                    </>
                }
                className='core-menu-options dm-menu-options'
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
        true,
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

export default memo(DmMenuOptions);
