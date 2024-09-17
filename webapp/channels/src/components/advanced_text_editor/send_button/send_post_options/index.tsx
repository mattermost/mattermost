// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import moment from 'moment/moment';
import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import Timestamp from 'components/timestamp';

import {ModalIdentifiers} from 'utils/constants';

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
    const userTimezone = useSelector(getCurrentTimezone);

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
        const today = moment().tz(userTimezone);
        const tomorrow9amTime = moment().tz(userTimezone);
        tomorrow9amTime.add(1, 'days').set({hour: 9, minute: 0, second: 0, millisecond: 0});

        const timeComponent = (
            <Timestamp
                value={tomorrow9amTime.valueOf()}
                useDate={false}
            />
        );

        const optionTomorrow = (
            <Menu.Item
                key={'scheduling_time_tomorrow_9_am'}
                onClick={(e) => handleOnSelect(e, tomorrow9amTime.valueOf())}
                labels={
                    <FormattedMessage
                        id='create_post_button.option.schedule_message.options.tomorrow'
                        defaultMessage='Tomorrow at {9amTime}'
                        values={{'9amTime': timeComponent}}
                    />
                }
            />
        );

        const nextMonday = moment().tz(userTimezone);
        nextMonday.day(8); // next monday; 1 = Monday, 8 = next Monday
        nextMonday.set({hour: 9, minute: 0, second: 0, millisecond: 0}); // 9 AM

        const optionNextMonday = (
            <Menu.Item
                key={'scheduling_time_next_monday_9_am'}
                onClick={(e) => handleOnSelect(e, nextMonday.valueOf())}
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
                key={'scheduling_time_monday_9_am'}
                onClick={(e) => handleOnSelect(e, nextMonday.valueOf())}
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

        switch (today.day()) {
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
    }, [handleOnSelect, userTimezone]);

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
