// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Moment} from 'moment-timezone';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    generateCurrentTimezoneLabel,
    getCurrentTimezone,
} from 'mattermost-redux/selectors/entities/timezone';

import DateTimePickerModal from 'components/date_time_picker_modal/post_reminder_custom_time_picker_modal';

type Props = {
    onClose: () => void;
    onConfirm: (timestamp: number) => void;
}

export default function ScheduledPostCustomTimeModal({onClose, onConfirm}: Props) {
    const {formatMessage} = useIntl();

    const userTimezone = useSelector(getCurrentTimezone);
    const userTimezoneLabel = generateCurrentTimezoneLabel(userTimezone);

    const title = formatMessage({id: 'schedule_post.custom_time_modal.title', defaultMessage: 'Schedule message'});
    const confirmButtonText = formatMessage({id: 'schedule_post.custom_time_modal.confirm_button_text', defaultMessage: 'Confirm'});
    const cancelButtonText = formatMessage({id: 'schedule_post.custom_time_modal.cancel_button_text', defaultMessage: 'Cancel'});

    const handleOnConfirm = useCallback((dateTime: Moment) => {
        onConfirm(dateTime.valueOf());
    }, [onConfirm]);

    return (
        <DateTimePickerModal
            header={title}
            subheading={userTimezoneLabel}
            confirmButtonText={confirmButtonText}
            cancelButtonText={cancelButtonText}
            ariaLabel={title}
            onExited={onClose}
            onCancel={onClose}
            onConfirm={handleOnConfirm}
        />
    );
}
