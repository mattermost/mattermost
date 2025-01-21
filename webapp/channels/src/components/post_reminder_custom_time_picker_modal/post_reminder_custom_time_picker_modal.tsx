// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import {getRoundedTime} from 'components/custom_status/date_time_input';
import DateTimePickerModal from 'components/date_time_picker_modal/date_time_picker_modal';

import {toUTCUnix} from 'utils/datetime';
import {getCurrentMomentForTimezone} from 'utils/timezone';

import type {PropsFromRedux} from './index';

type Props = PropsFromRedux & {
    onExited: () => void;
    postId: string;
    actions: {
        addPostReminder: (postId: string, userId: string, timestamp: number) => void;
    };
};

function PostReminderCustomTimePicker({userId, timezone, onExited, postId, actions}: Props) {
    const {formatMessage} = useIntl();
    const ariaLabel = formatMessage({id: 'post_reminder_custom_time_picker_modal.defaultMsg', defaultMessage: 'Set a reminder'});
    const header = formatMessage({id: 'post_reminder.custom_time_picker_modal.header', defaultMessage: 'Set a reminder'});
    const confirmButtonText = formatMessage({id: 'post_reminder.custom_time_picker_modal.submit_button', defaultMessage: 'Set reminder'});

    const currentTime = getCurrentMomentForTimezone(timezone);
    const initialReminderTime = getRoundedTime(currentTime);

    const handleConfirm = useCallback((dateTime: Moment) => {
        actions.addPostReminder(userId, postId, toUTCUnix(dateTime.toDate()));
        onExited();
    }, [actions, postId, userId, onExited]);

    return (
        <DateTimePickerModal
            onExited={onExited}
            ariaLabel={ariaLabel}
            header={header}
            initialTime={initialReminderTime}
            onConfirm={handleConfirm}
            confirmButtonText={confirmButtonText}
        />
    );
}

export default PostReminderCustomTimePicker;
