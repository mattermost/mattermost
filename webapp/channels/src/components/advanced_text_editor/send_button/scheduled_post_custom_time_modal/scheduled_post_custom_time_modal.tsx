// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
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
    isOneToOneDmChannel,
    reinterpretWallClock,
    useRecipientTimezoneToPerspective,
} from 'components/advanced_text_editor/send_button/schedule_message_utils';
import ScheduleRecipientTimezoneCheckbox from 'components/advanced_text_editor/send_button/schedule_recipient_timezone_checkbox';
import ScheduleTimezoneConversionLine from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/schedule_timezone_conversion_line';
import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import DateTimePickerModal from 'components/date_time_picker_modal/date_time_picker_modal';

import {scheduledPosts} from 'utils/constants';

import type {GlobalState} from 'types/store';

import './scheduled_post_custom_time_modal.scss';

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
    const isDmChannel = useSelector((state: GlobalState) => isOneToOneDmChannel(state, channelId));
    const {
        teammateDisplayName,
        recipientTimezoneString,
    } = useTimePostBoxIndicator(channelId);

    const [useRecipientTimezone, setUseRecipientTimezone] = useState(initialUseRecipientTimezone);
    const perspective = useRecipientTimezoneToPerspective(useRecipientTimezone);
    const useCustomFooter = isDmChannel || Boolean(onRemoveSchedule);

    const activeTimezone = useMemo(() => {
        if (!isDmChannel) {
            return userTimezone;
        }
        return useRecipientTimezone ? recipientTimezoneString : userTimezone;
    }, [isDmChannel, recipientTimezoneString, useRecipientTimezone, userTimezone]);

    const [selectedDateTime, setSelectedDateTime] = useState<Moment>(() => {
        if (initialTime) {
            if (isDmChannel) {
                const activeTz = initialUseRecipientTimezone ? recipientTimezoneString : userTimezone;
                return reinterpretWallClock(initialTime, activeTz);
            }

            return initialTime;
        }

        if (isDmChannel) {
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

    const subheading = isDmChannel ? (
        <ScheduleRecipientTimezoneCheckbox
            checked={useRecipientTimezone}
            recipientTimezone={recipientTimezoneString}
            onChange={handleUseRecipientTimezoneChange}
            variant='modal'
        />
    ) : userTimezoneLabel;

    const bodySuffix = isDmChannel ? (
        <ScheduleTimezoneConversionLine
            selectedDateTime={selectedDateTime}
            useRecipientTimezone={useRecipientTimezone}
            recipientName={teammateDisplayName}
            senderTimezone={userTimezone}
            recipientTimezone={recipientTimezoneString}
        />
    ) : undefined;

    const footerContent = useMemo(() => {
        if (!useCustomFooter) {
            return undefined;
        }

        return (
            <footer className='scheduled_post_custom_time_modal__footer'>
                {onRemoveSchedule && (
                    <Button
                        type='button'
                        emphasis='tertiary'
                        variant='destructive'
                        className='scheduled_post_custom_time_modal__remove'
                        onClick={handleRemoveSchedule}
                    >
                        <FormattedMessage
                            id='schedule_post.custom_time_modal.remove_schedule'
                            defaultMessage='Remove schedule'
                        />
                    </Button>
                )}
                <div className='scheduled_post_custom_time_modal__footer-actions'>
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
    }, [handleOnConfirm, handleRemoveSchedule, onExited, onRemoveSchedule, selectedDateTime, useCustomFooter]);

    return (
        <DateTimePickerModal
            className={classNames('scheduled_post_custom_time_modal', {
                'scheduled_post_custom_time_modal--custom-footer': useCustomFooter,
            })}
            initialTime={selectedDateTime}
            header={
                <FormattedMessage
                    id='schedule_post.custom_time_modal.title'
                    defaultMessage='Schedule message'
                />
            }
            subheading={subheading}
            confirmButtonText={useCustomFooter ? undefined : (
                <FormattedMessage
                    id='schedule_post.custom_time_modal.confirm_button_text'
                    defaultMessage='Schedule'
                />
            )}
            cancelButtonText={useCustomFooter ? undefined : (
                <FormattedMessage
                    id='schedule_post.custom_time_modal.cancel_button_text'
                    defaultMessage='Cancel'
                />
            )}
            ariaLabel={label}
            onExited={onExited}
            onConfirm={handleOnConfirm}
            onChange={setSelectedDateTime}
            bodySuffix={bodySuffix}
            relativeDate={true}
            onCancel={useCustomFooter ? undefined : onExited}
            errorText={errorMessage}
            timePickerInterval={timePickerInterval}
            timezone={isDmChannel ? activeTimezone : undefined}
            footerContent={footerContent}
        />
    );
}
