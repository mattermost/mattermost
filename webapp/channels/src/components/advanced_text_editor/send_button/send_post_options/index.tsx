// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import Timestamp from 'components/timestamp';

import {ModalIdentifiers} from 'utils/constants';

import './style.scss';
import ScheduledPostCustomTimeModal from '../scheduled_post_custom_time_modal/scheduled_post_custom_time_modal';

type Props = {
    channelId: string;
    disabled?: boolean;
    onSelect: (schedulingInfo: SchedulingInfo) => void;
}

export function SendPostOptions({disabled, onSelect, channelId}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

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
    }, [onSelect]);

    const handleChooseCustomTime = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.SCHEDULED_POST_CUSTOM_TIME_MODAL,
            dialogType: ScheduledPostCustomTimeModal,
            dialogProps: {
                channelId,
                onConfirm: handleSelectCustomTime,
            },
        }));
    }, [channelId, dispatch, handleSelectCustomTime]);

    const coreMenuOptions = useMemo(() => {
        const today = new Date();
        today.setHours(9, 0, 0, 0); // 9 AM
        const unixTimestamp = today.getTime();

        const timeComponent = (
            <Timestamp
                value={unixTimestamp}
                useDate={false}
            />
        );

        const tomorrow9amTime = new Date();
        tomorrow9amTime.setDate(today.getDate() + 1);
        tomorrow9amTime.setHours(9, 0, 0, 0);

        const optionTomorrow = (
            <Menu.Item
                key={'scheduling_time_tomorrow_9_am'}
                onClick={(e) => handleOnSelect(e, tomorrow9amTime.getTime())}
                labels={
                    <FormattedMessage
                        id='create_post_button.option.schedule_message.options.tomorrow'
                        defaultMessage='Tomorrow at {9amTime}'
                        values={{'9amTime': timeComponent}}
                    />
                }
            />
        );

        const nextMonday = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
        nextMonday.setHours(9, 0, 0, 0);
        nextMonday.setDate(today.getDate() + daysUntilNextMonday);

        const optionNextMonday = (
            <Menu.Item
                key={'scheduling_time_next_monday_9_am'}
                onClick={(e) => handleOnSelect(e, nextMonday.getTime())}
                labels={
                    <FormattedMessage
                        id='create_post_button.option.schedule_message.options.next_monday'
                        defaultMessage='Next Monday at {9amTime}'
                        values={{'9amTime': timeComponent}}
                    />
                }
            />
        );

        const optionMonday = (
            <Menu.Item
                key={'scheduling_time_next_monday_9_am'}
                onClick={(e) => handleOnSelect(e, nextMonday.getTime())}
                labels={
                    <FormattedMessage
                        id='create_post_button.option.schedule_message.options.monday'
                        defaultMessage='Monday at {9amTime}'
                        values={{
                            '9amTime': timeComponent,
                        }}
                    />
                }
            />
        );

        let options: React.ReactElement[] = [];

        switch (today.getDay()) {
        // Sunday
        case 0:
            options = [optionTomorrow];
            break;

        // Monday
        case 1:
            options = [optionTomorrow, optionNextMonday];
            break;

        // Friday and Saturday
        case 5:
        case 6:
            options = [optionMonday];
            break;

        // Tuesday to Thursday
        default:
            options = [optionTomorrow, optionMonday];
        }

        return options;
    }, [handleOnSelect]);

    return (
        <Menu.Container
            hideTooltipWhenDisabled={true}
            menuButtonTooltip={{
                id: 'send_post_option_schedule_post',
                text: formatMessage({
                    id: 'create_post_button.option.schedule_message',
                    defaultMessage: 'Schedule message',
                }),
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
                        defaultMessage='Scheduled message'
                    />
                }
            />

            {coreMenuOptions}

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
