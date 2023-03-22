// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {Moment} from 'moment-timezone';

import GenericModal from 'components/generic_modal';
import {isKeyPressed, localizeMessage} from 'utils/utils';
import DateTimeInput, {getRoundedTime} from 'components/custom_status/date_time_input';

import {toUTCUnix} from 'utils/datetime';
import {getCurrentMomentForTimezone} from 'utils/timezone';

import Constants from 'utils/constants';

import {PropsFromRedux} from './index';

import './post_reminder_custom_time_picker_modal.scss';

type Props = PropsFromRedux & {
    onExited: () => void;
    postId: string;
    actions: {
        addPostReminder: (postId: string, userId: string, timestamp: number) => void;
    };
};

const modalHeaderText = (
    <FormattedMessage
        id='post_reminder.custom_time_picker_modal.header'
        defaultMessage='Set a reminder'
    />
);
const confirmButtonText = (
    <FormattedMessage
        id='post_reminder.custom_time_picker_modal.submit_button'
        defaultMessage='Set reminder'
    />
);

function PostReminderCustomTimePicker({userId, timezone, onExited, postId, actions}: Props) {
    const currentTime = getCurrentMomentForTimezone(timezone);
    const initialReminderTime: Moment = getRoundedTime(currentTime);
    const [customReminderTime, setCustomReminderTime] = useState<Moment>(initialReminderTime);
    const handleConfirm = useCallback(() => {
        actions.addPostReminder(userId, postId, toUTCUnix(customReminderTime.toDate()));
    }, [customReminderTime]);

    const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (isKeyPressed(event, Constants.KeyCodes.ESCAPE) && !isDatePickerOpen) {
            onExited();
        }
    }, [isDatePickerOpen, onExited]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    return (
        <GenericModal
            ariaLabel={localizeMessage('post_reminder_custom_time_picker_modal.defaultMsg', 'Set a reminder')}
            onExited={onExited}
            modalHeaderText={modalHeaderText}
            confirmButtonText={confirmButtonText}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            id='PostReminderCustomTimePickerModal'
            className={'post-reminder-modal'}
            compassDesign={true}
            enforceFocus={true}
            keyboardEscape={false}
        >
            <DateTimeInput
                time={customReminderTime}
                handleChange={setCustomReminderTime}
                timezone={timezone}
                setIsDatePickerOpen={setIsDatePickerOpen}
            />
        </GenericModal>
    );
}

export default PostReminderCustomTimePicker;
