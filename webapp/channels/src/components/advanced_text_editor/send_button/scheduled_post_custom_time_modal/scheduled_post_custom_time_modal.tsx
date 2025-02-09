// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import type {Moment} from 'moment-timezone';
import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {testingEnabled} from 'mattermost-redux/selectors/entities/general';
import {generateCurrentTimezoneLabel, getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {
    DMUserTimezone,
} from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/dm_user_timezone';
import DateTimePickerModal from 'components/date_time_picker_modal/date_time_picker_modal';

import {scheduledPosts} from 'utils/constants';

type Props = {
    channelId: string;
    onExited: () => void;
    onConfirm: (timestamp: number) => Promise<{error?: string}>;
    initialTime?: Moment;
}

export default function ScheduledPostCustomTimeModal({channelId, onExited, onConfirm, initialTime}: Props) {
    const {formatMessage} = useIntl();
    const [errorMessage, setErrorMessage] = useState<string>();
    const userTimezone = useSelector(getCurrentTimezone);
    const now = moment().tz(userTimezone);
    const currentUserId = useSelector(getCurrentUserId);
    const dispatch = useDispatch();
    const [selectedDateTime, setSelectedDateTime] = useState<Moment>(() => {
        if (initialTime) {
            return initialTime;
        }

        return now.add(1, 'days').set({hour: 9, minute: 0, second: 0, millisecond: 0});
    });

    const userTimezoneLabel = useMemo(() => generateCurrentTimezoneLabel(userTimezone), [userTimezone]);

    const handleOnConfirm = useCallback(async (dateTime: Moment) => {
        const selectedTime = dateTime.valueOf();
        const response = await onConfirm(selectedTime);

        dispatch(
            savePreferences(
                currentUserId,
                [{
                    user_id: currentUserId,
                    category: scheduledPosts.SCHEDULED_POSTS,
                    name: scheduledPosts.RECENTLY_USED_CUSTOM_TIME,
                    value: JSON.stringify({update_at: moment().tz(userTimezone).valueOf(), timestamp: selectedTime}),
                }],
            ),
        );

        if (response.error) {
            setErrorMessage(response.error);
        } else {
            onExited();
        }
    }, [onConfirm, onExited]);

    const bodySuffix = useMemo(() => {
        return (
            <DMUserTimezone
                channelId={channelId}
                selectedTime={selectedDateTime?.toDate()}
            />
        );
    }, [channelId, selectedDateTime]);

    const label = formatMessage({id: 'schedule_post.custom_time_modal.title', defaultMessage: 'Schedule message'});

    const timePickerInterval = useSelector(testingEnabled) ? 1 : undefined;

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
                    defaultMessage='Confirm'
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
