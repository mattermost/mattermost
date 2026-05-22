// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {memo, useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentLocale} from 'selectors/i18n';

import {
    getRecipientLocationLabel,
    getTheirMorningTimestamp,
} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import * as Menu from 'components/menu';
import Timestamp from 'components/timestamp';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    channelId: string;
}

function formatTimeInTimezone(timestamp: number, timezone: string, locale: string): string {
    return DateTime.fromMillis(timestamp, {zone: 'utc'}).
        setZone(timezone).
        setLocale(locale).
        toLocaleString(DateTime.TIME_SIMPLE);
}

function formatWeekdayInTimezone(timestamp: number, timezone: string, locale: string): string {
    return DateTime.fromMillis(timestamp, {zone: 'utc'}).
        setZone(timezone).
        setLocale(locale).
        toFormat('ccc');
}

function DmMenuOptions({handleOnSelect, channelId}: Props) {
    const {
        userCurrentTimezone,
        recipientTimezoneString,
    } = useTimePostBoxIndicator(channelId);

    const locale = useSelector(getCurrentLocale);

    const theirMorningTimestamp = useMemo(
        () => getTheirMorningTimestamp(recipientTimezoneString),
        [recipientTimezoneString],
    );

    const theirMorningSubtitle = useMemo(() => {
        const theirDay = formatWeekdayInTimezone(theirMorningTimestamp, recipientTimezoneString, locale);
        const theirTime = formatTimeInTimezone(theirMorningTimestamp, recipientTimezoneString, locale);
        const senderTime = formatTimeInTimezone(theirMorningTimestamp, userCurrentTimezone, locale);

        return (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.their_morning.subtitle'
                defaultMessage='{theirDay} {theirTime} · {senderTime} yours'
                values={{
                    theirDay,
                    theirTime,
                    senderTime,
                }}
            />
        );
    }, [theirMorningTimestamp, recipientTimezoneString, userCurrentTimezone, locale]);

    const handleTheirMorningClick = useCallback(
        (e: React.UIEvent) => handleOnSelect(e, theirMorningTimestamp),
        [handleOnSelect, theirMorningTimestamp],
    );

    return (
        <Menu.Item
            key='scheduling_time_their_morning'
            data-testid='scheduling_time_their_morning'
            onClick={handleTheirMorningClick}
            labels={
                <>
                    <span>
                        <FormattedMessage
                            id='create_post_button.option.schedule_message.options.their_morning'
                            defaultMessage='Their morning'
                        />
                    </span>
                    <span className='secondary-label'>
                        {theirMorningSubtitle}
                    </span>
                </>
            }
            className='core-menu-options dm-menu-options'
            autoFocus={true}
        />
    );
}

export function DmScheduleHeader({channelId}: {channelId: string}) {
    const {
        teammateTimezone,
        teammateDisplayName,
        recipientTimezoneString,
        teammate,
        currentUserTimesStamp,
    } = useTimePostBoxIndicator(channelId);

    const locationLabel = useMemo(
        () => getRecipientLocationLabel(teammate, recipientTimezoneString),
        [teammate, recipientTimezoneString],
    );

    return (
        <Menu.Item
            disabled={true}
            labels={
                <>
                    <span>
                        <FormattedMessage
                            id='create_post_button.option.schedule_message.options.dm_header'
                            defaultMessage='Schedule for {recipientName}'
                            values={{recipientName: teammateDisplayName}}
                        />
                    </span>
                    <span className='secondary-label'>
                        <FormattedMessage
                            id='create_post_button.option.schedule_message.options.dm_header.subtitle'
                            defaultMessage='{location} · {time} now'
                            values={{
                                location: locationLabel,
                                time: (
                                    <Timestamp
                                        value={currentUserTimesStamp}
                                        useDate={false}
                                        userTimezone={teammateTimezone}
                                        useTime={{
                                            hour: 'numeric',
                                            minute: 'numeric',
                                        }}
                                    />
                                ),
                            }}
                        />
                    </span>
                </>
            }
            className='dm-schedule-header'
        />
    );
}

export default memo(DmMenuOptions);
