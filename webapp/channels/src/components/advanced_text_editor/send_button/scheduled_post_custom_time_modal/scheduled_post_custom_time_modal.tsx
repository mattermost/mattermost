// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import type {Moment} from 'moment-timezone';
import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {generateCurrentTimezoneLabel, getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {
    DMUserTimezone,
} from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/dm_user_timezone';
import DateTimePickerModal from 'components/date_time_picker_modal/date_time_picker_modal';

type Props = {
    channelId: string;
    onExited: () => void;
    onConfirm: (timestamp: number) => void;
}

export default function ScheduledPostCustomTimeModal({channelId, onExited, onConfirm}: Props) {
    const {formatMessage} = useIntl();
    const userTimezone = useSelector(getCurrentTimezone);
    const [selectedDateTime, setSelectedDateTime] = useState<Moment>(() => {
        const now = moment().tz(userTimezone);
        return now.add(1, 'days').set({hour: 9, minute: 0, second: 0, millisecond: 0});
    });

    const userTimezoneLabel = useMemo(() => generateCurrentTimezoneLabel(userTimezone), [userTimezone]);

    const handleOnConfirm = useCallback((dateTime: Moment) => {
        onConfirm(dateTime.valueOf());
    }, [onConfirm]);

    const bodySuffix = useMemo(() => {
        return (
            <DMUserTimezone
                channelId={channelId}
                selectedTime={selectedDateTime?.toDate()}
            />
        );
    }, [selectedDateTime]);

    const label = formatMessage({id: 'schedule_post.custom_time_modal.title', defaultMessage: 'Schedule message'});

    return (
        <DateTimePickerModal
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
        />
    );
}
