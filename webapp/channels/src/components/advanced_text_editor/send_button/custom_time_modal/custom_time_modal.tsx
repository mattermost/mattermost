// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import type {Moment} from 'moment-timezone';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {
    generateCurrentTimezoneLabel,
    getCurrentTimezone,
} from 'mattermost-redux/selectors/entities/timezone';

import {DMUserTimezone} from 'components/advanced_text_editor/send_button/custom_time_modal/dmUserTimezone';
import DateTimePickerModal from 'components/date_time_picker_modal/post_reminder_custom_time_picker_modal';

type Props = {
    onClose: () => void;
    onConfirm: (timestamp: number) => void;
}

export default function ScheduledPostCustomTimeModal({onClose, onConfirm}: Props) {
    const {formatMessage} = useIntl();

    const [selectedDateTime, setSelectedDateTime] = useState<Moment>();

    // current user's timezone
    const userTimezone = useSelector(getCurrentTimezone);
    const userTimezoneLabel = generateCurrentTimezoneLabel(userTimezone);

    const title = formatMessage({id: 'schedule_post.custom_time_modal.title', defaultMessage: 'Schedule message'});
    const confirmButtonText = formatMessage({id: 'schedule_post.custom_time_modal.confirm_button_text', defaultMessage: 'Confirm'});
    const cancelButtonText = formatMessage({id: 'schedule_post.custom_time_modal.cancel_button_text', defaultMessage: 'Cancel'});

    useEffect(() => {
        if (selectedDateTime !== undefined) {
            return;
        }

        const now = moment().tz(userTimezone);

        // Create a new Moment object for tomorrow at 9 AM in the same timezone
        const tomorrowAt9AM = now.add(1, 'days').set({hour: 9, minute: 0, second: 0, millisecond: 0});
        setSelectedDateTime(tomorrowAt9AM);
    }, [userTimezone, selectedDateTime]);

    const handleOnConfirm = useCallback((dateTime: Moment) => {
        onConfirm(dateTime.valueOf());
    }, [onConfirm]);

    const bodySuffix = useMemo(() => {
        return (
            <DMUserTimezone selectedTime={selectedDateTime?.toDate()}/>
        );
    }, [selectedDateTime]);

    if (!selectedDateTime) {
        return null;
    }

    return (
        <DateTimePickerModal
            initialTime={selectedDateTime}
            header={title}
            subheading={userTimezoneLabel}
            confirmButtonText={confirmButtonText}
            cancelButtonText={cancelButtonText}
            ariaLabel={title}
            onExited={onClose}
            onCancel={onClose}
            onConfirm={handleOnConfirm}
            onChange={setSelectedDateTime}
            bodySuffix={bodySuffix}
            relativeDate={true}
        />
    );
}
