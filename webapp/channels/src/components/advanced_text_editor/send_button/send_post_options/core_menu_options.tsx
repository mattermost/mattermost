// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
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
import Timestamp from 'components/timestamp';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    channelId: string;
}

function CoreMenuOptions({handleOnSelect, channelId}: Props) {
    const {
        userCurrentTimezone,
        teammateTimezone,
        timestamp,
        teammateDisplayName,
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

    const today = moment().tz(userCurrentTimezone);
    const tomorrow9amTime = moment().
        tz(userCurrentTimezone).
        add(1, 'days').
        set({hour: 9, minute: 0, second: 0, millisecond: 0}).
        valueOf();

    const timeComponent = (
        <Timestamp
            value={tomorrow9amTime.valueOf()}
            useDate={false}
        />
    );

    const dmTeammateTimezone = (
        <FormattedMessage
            id='create_post_button.option.schedule_message.options.remote_user_hour'
            defaultMessage='{time} {user} time'
            values={{
                user: (
                    <span className='userDisplayName'>
                        {teammateDisplayName}
                    </span>
                ),
                time: (
                    <Timestamp
                        useRelative={false}
                        value={timestamp}
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
    );

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
            trailingElements={dmTeammateTimezone}
        />
    );

    const nextMonday = moment().
        tz(userCurrentTimezone).
        day(8). // next monday; 1 = Monday, 8 = next Monday
        set({hour: 9, minute: 0, second: 0, millisecond: 0}). // 9 AM
        valueOf();

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
            trailingElements={dmTeammateTimezone}
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
            trailingElements={dmTeammateTimezone}
        />
    );

    let options: React.ReactElement[] = [];

    switch (today.day()) {
    // Sunday
    case 0:
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
        <React.Fragment>
            {options}
        </React.Fragment>
    );
}

export default memo(CoreMenuOptions);
