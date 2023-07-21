// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GenericModal} from '@mattermost/components';
import React, {useCallback, useEffect, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import DateTimeInput, {getRoundedTime} from 'components/custom_status/date_time_input';

import Constants from 'utils/constants';
import {toUTCUnix} from 'utils/datetime';
import {isKeyPressed} from 'utils/keyboard';
import {getCurrentMomentForTimezone} from 'utils/timezone';

import type {PropsFromRedux} from './index';
import './post_reminder_custom_time_picker_modal.scss';

type Props = PropsFromRedux & {
    onExited: () => void;
    postId: string;
    actions: {
        addPostReminder: (postId: string, userId: string, timestamp: number) => void;
    };
};

function PostReminderCustomTimePicker({userId, timezone, onExited, postId, actions}: Props) {
    const currentTime = getCurrentMomentForTimezone(timezone);
    const initialReminderTime = getRoundedTime(currentTime);

    const [customReminderTime, setCustomReminderTime] = useState(initialReminderTime);

    const handleConfirm = useCallback(() => {
        actions.addPostReminder(userId, postId, toUTCUnix(customReminderTime.toDate()));
    }, [customReminderTime]);

    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

    const {formatMessage} = useIntl();

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (isKeyPressed(event, Constants.KeyCodes.ESCAPE) && !isDatePickerOpen) {
                onExited();
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDatePickerOpen]);

    return (
        <GenericModal
            id='PostReminderCustomTimePickerModal'
            ariaLabel={formatMessage({id: 'post_reminder_custom_time_picker_modal.defaultMsg', defaultMessage: 'Set a reminder'})}
            onExited={onExited}
            modalHeaderText={(
                <FormattedMessage
                    id='post_reminder.custom_time_picker_modal.header'
                    defaultMessage='Set a reminder'
                />
            )}
            confirmButtonText={(
                <FormattedMessage
                    id='post_reminder.custom_time_picker_modal.submit_button'
                    defaultMessage='Set reminder'
                />
            )}
            handleConfirm={handleConfirm}
            handleEnterKeyPress={handleConfirm}
            className={'post-reminder-modal'}
            compassDesign={true}
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
