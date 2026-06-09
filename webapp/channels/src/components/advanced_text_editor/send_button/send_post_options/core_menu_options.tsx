// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {DateTime} from 'luxon';
import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    getNextMonday9amTimestamp,
    getTomorrow9amTimestamp,
    isDmScheduleRedesign,
} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import * as Menu from 'components/menu';
import Timestamp from 'components/timestamp';

import type {GlobalState} from 'types/store';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    channelId: string;
}

function CoreMenuOptions({handleOnSelect, channelId}: Props) {
    const isDmRedesign = useSelector((state: GlobalState) => isDmScheduleRedesign(state, channelId));

    if (isDmRedesign) {
        return null;
    }

    return (
        <LegacyCoreMenuOptions
            handleOnSelect={handleOnSelect}
            channelId={channelId}
        />
    );
}

function LegacyCoreMenuOptions({handleOnSelect, channelId}: Props) {
    const {userCurrentTimezone} = useTimePostBoxIndicator(channelId);

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
            className='core-menu-options'
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
            className='core-menu-options'
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
            className='core-menu-options'
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

export default memo(CoreMenuOptions);
