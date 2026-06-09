// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import type {Moment} from 'moment-timezone';
import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {testingEnabled} from 'mattermost-redux/selectors/entities/general';
import {generateCurrentTimezoneLabel, getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {
    getDefaultScheduleDateTime,
    isDmScheduleRedesign,
    reinterpretWallClock,
    useRecipientTimezoneToPerspective,
} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import ScheduleRecipientTimezoneCheckbox from 'components/advanced_text_editor/send_button/schedule_recipient_timezone_checkbox';
import {
    DMUserTimezone,
} from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/dm_user_timezone';
import ScheduleTimezoneConversionLine from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/schedule_timezone_conversion_line';
import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import DateTimePickerModal from 'components/date_time_picker_modal/date_time_picker_modal';

import {scheduledPosts} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './scheduled_post_dm_custom_time_modal.scss';

const SCHEDULED_POST_CUSTOM_TIME_INTERVAL = 15; // minutes

type Props = {
    channelId: string;
    onExited: () => void;
    onConfirm: (timestamp: number) => Promise<{error?: string}>;
    initialTime?: Moment;
    useRecipientTimezone?: boolean;
    onRemoveSchedule?: () => void | Promise<{error?: string} | void>;
}

export default function ScheduledPostCustomTimeModal({
    channelId,
    onExited,
    onConfirm,
    initialTime,
    useRecipientTimezone: initialUseRecipientTimezone = true,
    onRemoveSchedule,
}: Props) {
    const {formatMessage} = useIntl();
    const [errorMessage, setErrorMessage] = useState<string>();
    const userTimezone = useSelector(getCurrentTimezone);
    const currentUserId = useSelector(getCurrentUserId);
    const dispatch = useDispatch();
    const isDmRedesign = useSelector((state: GlobalState) => isDmScheduleRedesign(state, channelId));
    const {
        teammateDisplayName,
        recipientTimezoneString,
    } = useTimePostBoxIndicator(channelId);

    const [useRecipientTimezone, setUseRecipientTimezone] = useState(initialUseRecipientTimezone);
    const perspective = useRecipientTimezoneToPerspective(useRecipientTimezone);

    const activeTimezone = useMemo(() => {
        if (!isDmRedesign) {
            return userTimezone;
        }
        return useRecipientTimezone ? recipientTimezoneString : userTimezone;
    }, [isDmRedesign, recipientTimezoneString, useRecipientTimezone, userTimezone]);

    const [selectedDateTime, setSelectedDateTime] = useState<Moment>(() => {
        if (initialTime) {
            return initialTime;
        }

        if (isDmRedesign) {
            return getDefaultScheduleDateTime(perspective, userTimezone, recipientTimezoneString);
        }

        return moment().tz(userTimezone).add(1, 'days').set({
            hour: 9,
            minute: 0,
            second: 0,
            millisecond: 0,
        });
    });

    const userTimezoneLabel = useMemo(() => generateCurrentTimezoneLabel(userTimezone), [userTimezone]);

    const handleUseRecipientTimezoneChange = useCallback((checked: boolean) => {
        if (checked === useRecipientTimezone) {
            return;
        }

        const newTimezone = checked ? recipientTimezoneString : userTimezone;
        setSelectedDateTime((current) => reinterpretWallClock(current, newTimezone));
        setUseRecipientTimezone(checked);
    }, [recipientTimezoneString, useRecipientTimezone, userTimezone]);

    const handleRemoveSchedule = useCallback(async () => {
        if (onRemoveSchedule) {
            const result = await onRemoveSchedule();
            if (result?.error) {
                setErrorMessage(result.error);
                return;
            }
        }
        onExited();
    }, [onExited, onRemoveSchedule]);

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
    }, [currentUserId, dispatch, onConfirm, onExited, userTimezone]);

    const label = formatMessage({id: 'schedule_post.custom_time_modal.title', defaultMessage: 'Schedule message'});

    const timePickerInterval = useSelector(testingEnabled) ? 1 : SCHEDULED_POST_CUSTOM_TIME_INTERVAL;

    const legacyBodySuffix = useMemo(() => {
        return (
            <DMUserTimezone
                channelId={channelId}
                selectedTime={selectedDateTime?.toDate()}
            />
        );
    }, [channelId, selectedDateTime]);

    if (isDmRedesign) {
        const bodyPrefix = (
            <ScheduleRecipientTimezoneCheckbox
                checked={useRecipientTimezone}
                recipientTimezone={recipientTimezoneString}
                onChange={handleUseRecipientTimezoneChange}
                className='scheduled_post_dm_custom_time_modal__timezone-checkbox'
            />
        );

        const bodySuffix = (
            <ScheduleTimezoneConversionLine
                selectedDateTime={selectedDateTime}
                useRecipientTimezone={useRecipientTimezone}
                recipientName={teammateDisplayName}
                senderTimezone={userTimezone}
                recipientTimezone={recipientTimezoneString}
            />
        );

        const footerContent = (
            <footer className='scheduled_post_dm_custom_time_modal__footer'>
                <Button
                    type='button'
                    emphasis='tertiary'
                    variant='destructive'
                    className='scheduled_post_dm_custom_time_modal__remove'
                    onClick={handleRemoveSchedule}
                >
                    <FormattedMessage
                        id='schedule_post.custom_time_modal.remove_schedule'
                        defaultMessage='Remove schedule'
                    />
                </Button>
                <div className='scheduled_post_dm_custom_time_modal__footer-actions'>
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={onExited}
                    >
                        <FormattedMessage
                            id='schedule_post.custom_time_modal.cancel_button_text'
                            defaultMessage='Cancel'
                        />
                    </Button>
                    <Button
                        type='submit'
                        emphasis='primary'
                        onClick={() => handleOnConfirm(selectedDateTime)}
                    >
                        <FormattedMessage
                            id='schedule_post.custom_time_modal.confirm_button_text'
                            defaultMessage='Schedule'
                        />
                    </Button>
                </div>
            </footer>
        );

        return (
            <DateTimePickerModal
                className='scheduled_post_custom_time_modal scheduled_post_dm_custom_time_modal'
                initialTime={selectedDateTime}
                header={
                    <FormattedMessage
                        id='schedule_post.custom_time_modal.title'
                        defaultMessage='Schedule message'
                    />
                }
                ariaLabel={label}
                onExited={onExited}
                onConfirm={handleOnConfirm}
                onChange={setSelectedDateTime}
                bodyPrefix={bodyPrefix}
                bodySuffix={bodySuffix}
                relativeDate={true}
                errorText={errorMessage}
                timePickerInterval={timePickerInterval}
                timezone={activeTimezone}
                footerContent={footerContent}
            />
        );
    }

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
            bodySuffix={legacyBodySuffix}
            relativeDate={true}
            onCancel={onExited}
            errorText={errorMessage}
            timePickerInterval={timePickerInterval}
        />
    );
}
