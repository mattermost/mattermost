// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import type {Moment} from 'moment-timezone';
import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {testingEnabled} from 'mattermost-redux/selectors/entities/general';
import {generateCurrentTimezoneLabel, getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {
    DMUserTimezone,
} from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/dm_user_timezone';
import DateTimePickerModal from 'components/date_time_picker_modal/date_time_picker_modal';

import {scheduledPosts} from 'utils/constants';

import './scheduled_post_custom_time_modal.scss';

const SCHEDULED_POST_CUSTOM_TIME_INTERVAL = 15; // minutes

type Props = {
    channelId: string;
    onExited: () => void;
    onConfirm: (schedulingInfo: SchedulingInfo) => Promise<{error?: string}>;
    initialTime?: Moment;
    initialRepeatWeekly?: boolean;
    initialRepeatTimezone?: string;
}

export default function ScheduledPostCustomTimeModal({
    channelId,
    onExited,
    onConfirm,
    initialTime,
    initialRepeatWeekly = false,
    initialRepeatTimezone,
}: Props) {
    const {formatMessage} = useIntl();
    const [errorMessage, setErrorMessage] = useState<string>();
    const currentUserTimezone = useSelector(getCurrentTimezone);
    const [repeatWeekly, setRepeatWeekly] = useState(initialRepeatWeekly);
    const effectiveTimezone = repeatWeekly && initialRepeatTimezone ? initialRepeatTimezone : currentUserTimezone;
    const now = moment().tz(effectiveTimezone);
    const currentUserId = useSelector(getCurrentUserId);
    const dispatch = useDispatch();
    const [selectedDateTime, setSelectedDateTime] = useState<Moment>(() => {
        if (initialTime) {
            return initialTime;
        }

        return now.add(1, 'days').set({hour: 9, minute: 0, second: 0, millisecond: 0});
    });

    const userTimezoneLabel = useMemo(() => generateCurrentTimezoneLabel(effectiveTimezone), [effectiveTimezone]);

    const handleOnConfirm = useCallback(async (dateTime: Moment) => {
        const selectedTime = dateTime.valueOf();
        const schedulingInfo: SchedulingInfo = {
            scheduled_at: selectedTime,
            ...(repeatWeekly ? {repeat_type: 'weekly' as const, repeat_timezone: effectiveTimezone} : {repeat_type: '', repeat_timezone: ''}),
        };
        const response = await onConfirm(schedulingInfo);

        dispatch(
            savePreferences(
                currentUserId,
                [{
                    user_id: currentUserId,
                    category: scheduledPosts.SCHEDULED_POSTS,
                    name: scheduledPosts.RECENTLY_USED_CUSTOM_TIME,
                    value: JSON.stringify({update_at: moment().tz(currentUserTimezone).valueOf(), timestamp: selectedTime}),
                }],
            ),
        );

        if (response.error) {
            setErrorMessage(response.error);
        } else {
            onExited();
        }
    }, [onConfirm, onExited, repeatWeekly, effectiveTimezone, dispatch, currentUserId, currentUserTimezone]);

    const bodySuffix = useMemo(() => {
        return (
            <>
                <div className='ScheduledPostCustomTimeModal__repeat'>
                    <input
                        id='scheduled_post_repeat_weekly'
                        type='checkbox'
                        checked={repeatWeekly}
                        onChange={(e) => setRepeatWeekly(e.target.checked)}
                        aria-label={formatMessage({
                            id: 'schedule_post.custom_time_modal.repeat_weekly',
                            defaultMessage: 'Repeat weekly',
                        })}
                    />
                    <label htmlFor='scheduled_post_repeat_weekly'>
                        <FormattedMessage
                            id='schedule_post.custom_time_modal.repeat_weekly'
                            defaultMessage='Repeat weekly'
                        />
                    </label>
                </div>
                <DMUserTimezone
                    channelId={channelId}
                    selectedTime={selectedDateTime?.toDate()}
                />
            </>
        );
    }, [channelId, selectedDateTime, repeatWeekly, formatMessage]);

    const label = formatMessage({id: 'schedule_post.custom_time_modal.title', defaultMessage: 'Schedule message'});

    const timePickerInterval = useSelector(testingEnabled) ? 1 : SCHEDULED_POST_CUSTOM_TIME_INTERVAL;

    return (
        <DateTimePickerModal
            className='scheduled_post_custom_time_modal'
            initialTime={selectedDateTime}
            header={
                <FormattedMessage
                    id='schedule_post.custom_time_modal.title'
                    defaultMessage='Schedule message'
                />
            }
            subheading={userTimezoneLabel}
            confirmButtonText={
                <FormattedMessage
                    id='schedule_post.custom_time_modal.confirm_button_text'
                    defaultMessage='Schedule'
                />
            }
            cancelButtonText={
                <FormattedMessage
                    id='schedule_post.custom_time_modal.cancel_button_text'
                    defaultMessage='Cancel'
                />
            }
            ariaLabel={label}
            onExited={onExited}
            onConfirm={handleOnConfirm}
            onChange={setSelectedDateTime}
            bodySuffix={bodySuffix}
            relativeDate={true}
            onCancel={onExited}
            errorText={errorMessage}
            timePickerInterval={timePickerInterval}
        />
    );
}
