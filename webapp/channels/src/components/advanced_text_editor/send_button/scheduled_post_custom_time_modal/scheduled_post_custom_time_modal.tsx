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
    getDefaultScheduleDateTime,
    isDmScheduleRedesign,
    reinterpretWallClock,
    type SchedulePerspective,
} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import {
    DMUserTimezone,
} from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/dm_user_timezone';
import ScheduleDualTimePreview from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/schedule_dual_time_preview';
import SchedulePerspectiveToggle from 'components/advanced_text_editor/send_button/scheduled_post_custom_time_modal/schedule_perspective_toggle';
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
}

export default function ScheduledPostCustomTimeModal({channelId, onExited, onConfirm, initialTime}: Props) {
    const {formatMessage} = useIntl();
    const [errorMessage, setErrorMessage] = useState<string>();
    const userTimezone = useSelector(getCurrentTimezone);
    const currentUserId = useSelector(getCurrentUserId);
    const dispatch = useDispatch();
    const isDmRedesign = useSelector((state: GlobalState) => isDmScheduleRedesign(state, channelId));
    const {
        teammateDisplayName,
        teammateFirstName,
        recipientTimezoneString,
    } = useTimePostBoxIndicator(channelId);

    const [perspective, setPerspective] = useState<SchedulePerspective>('theirs');

    const activeTimezone = useMemo(() => {
        if (!isDmRedesign) {
            return userTimezone;
        }
        return perspective === 'theirs' ? recipientTimezoneString : userTimezone;
    }, [isDmRedesign, perspective, recipientTimezoneString, userTimezone]);

    const [selectedDateTime, setSelectedDateTime] = useState<Moment>(() => {
        if (initialTime) {
            return initialTime;
        }

        if (isDmRedesign) {
            return getDefaultScheduleDateTime('theirs', userTimezone, recipientTimezoneString);
        }

        return moment().tz(userTimezone).add(1, 'days').set({
            hour: 9,
            minute: 0,
            second: 0,
            millisecond: 0,
        });
    });

    const userTimezoneLabel = useMemo(() => generateCurrentTimezoneLabel(userTimezone), [userTimezone]);

    const handlePerspectiveChange = useCallback((newPerspective: SchedulePerspective) => {
        if (newPerspective === perspective) {
            return;
        }

        const newTimezone = newPerspective === 'theirs' ? recipientTimezoneString : userTimezone;
        setSelectedDateTime((current) => reinterpretWallClock(current, newTimezone));
        setPerspective(newPerspective);
    }, [perspective, recipientTimezoneString, userTimezone]);

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
            <SchedulePerspectiveToggle
                perspective={perspective}
                recipientFirstName={teammateFirstName}
                onChange={handlePerspectiveChange}
            />
        );

        const bodySuffix = (
            <ScheduleDualTimePreview
                selectedDateTime={selectedDateTime}
                perspective={perspective}
                recipientName={teammateDisplayName}
                senderTimezone={userTimezone}
                recipientTimezone={recipientTimezoneString}
            />
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
                subheading={
                    <FormattedMessage
                        id='schedule_post.custom_time_modal.dm_subtitle'
                        defaultMessage='to {recipientName}'
                        values={{recipientName: teammateDisplayName}}
                    />
                }
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
                bodyPrefix={bodyPrefix}
                bodySuffix={bodySuffix}
                relativeDate={true}
                onCancel={onExited}
                errorText={errorMessage}
                timePickerInterval={timePickerInterval}
                timezone={activeTimezone}
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
