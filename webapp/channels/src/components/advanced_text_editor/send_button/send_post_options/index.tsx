// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {openModal} from 'actions/views/modals';

import {isDmScheduleRedesign} from 'components/advanced_text_editor/send_button/schedule_message_dm_utils';
import ScheduleRecipientTimezoneCheckbox from 'components/advanced_text_editor/send_button/schedule_recipient_timezone_checkbox';
import CoreMenuOptions from 'components/advanced_text_editor/send_button/send_post_options/core_menu_options';
import DmMenuOptions from 'components/advanced_text_editor/send_button/send_post_options/dm_menu_options';
import RecentUsedCustomDate from 'components/advanced_text_editor/send_button/send_post_options/recent_used_custom_date';
import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import ScheduledPostCustomTimeModal from '../scheduled_post_custom_time_modal/scheduled_post_custom_time_modal';

import './style.scss';

type Props = {
    channelId: string;
    disabled?: boolean;
    onSelect: (schedulingInfo: SchedulingInfo) => void;
}

export function SendPostOptions({disabled, onSelect, channelId}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const isDmRedesign = useSelector((state: GlobalState) => isDmScheduleRedesign(state, channelId));
    const {userCurrentTimezone, recipientTimezoneString, teammateDisplayName} = useTimePostBoxIndicator(channelId);
    const [useRecipientTimezone, setUseRecipientTimezone] = useState(true);

    const handleOnSelect = useCallback((e: React.FormEvent, scheduledAt: number) => {
        e.preventDefault();
        e.stopPropagation();

        const schedulingInfo: SchedulingInfo = {
            scheduled_at: scheduledAt,
        };

        onSelect(schedulingInfo);
    }, [onSelect]);

    const handleSelectCustomTime = useCallback((scheduledAt: number) => {
        const schedulingInfo: SchedulingInfo = {
            scheduled_at: scheduledAt,
        };

        onSelect(schedulingInfo);
        return Promise.resolve({});
    }, [onSelect]);

    const handleChooseCustomTime = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.SCHEDULED_POST_CUSTOM_TIME_MODAL,
            dialogType: ScheduledPostCustomTimeModal,
            dialogProps: {
                channelId,
                onConfirm: handleSelectCustomTime,
                useRecipientTimezone,
            },
        }));
    }, [channelId, dispatch, handleSelectCustomTime, useRecipientTimezone]);

    return (
        <Menu.Container
            menuButtonTooltip={{
                text: formatMessage({
                    id: 'create_post_button.option.schedule_message',
                    defaultMessage: 'Schedule message',
                }),
                disabled,
            }}
            menuButton={{
                id: 'button_send_post_options',
                class: classNames('button_send_post_options', {disabled}),
                children: <ChevronDownIcon size={16}/>,
                disabled,
                'aria-label': formatMessage({
                    id: 'create_post_button.option.schedule_message',
                    defaultMessage: 'Schedule message',
                }),
            }}
            menu={{
                id: 'dropdown_send_post_options',
            }}
            transformOrigin={{
                horizontal: 'right',
                vertical: 'bottom',
            }}
            anchorOrigin={{
                vertical: 'top',
                horizontal: 'right',
            }}
        >
            <Menu.Item
                disabled={true}
                labels={
                    <FormattedMessage
                        id='create_post_button.option.schedule_message.options.header'
                        defaultMessage='Schedule message'
                    />
                }
            />

            {isDmRedesign && (
                <ScheduleRecipientTimezoneCheckbox
                    checked={useRecipientTimezone}
                    recipientTimezone={recipientTimezoneString}
                    onChange={setUseRecipientTimezone}
                    className='dm-schedule-timezone-checkbox'
                />
            )}

            {isDmRedesign ? (
                <DmMenuOptions
                    handleOnSelect={handleOnSelect}
                    channelId={channelId}
                    useRecipientTimezone={useRecipientTimezone}
                />
            ) : (
                <CoreMenuOptions
                    handleOnSelect={handleOnSelect}
                    channelId={channelId}
                />
            )}

            <RecentUsedCustomDate
                handleOnSelect={handleOnSelect}
                userCurrentTimezone={userCurrentTimezone}
                channelId={channelId}
                isDmRedesign={isDmRedesign}
                recipientTimezoneString={recipientTimezoneString}
                useRecipientTimezone={useRecipientTimezone}
                recipientDisplayName={teammateDisplayName}
            />

            <Menu.Separator/>

            <Menu.Item
                onClick={handleChooseCustomTime}
                key={'choose_custom_time'}
                labels={
                    <FormattedMessage
                        id='create_post_button.option.schedule_message.options.choose_custom_time'
                        defaultMessage='Choose a custom time'
                    />
                }
            />

        </Menu.Container>
    );
}
