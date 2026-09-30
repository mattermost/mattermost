// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import type {SchedulingInfo} from '@mattermost/types/schedule_post';

import {openModal} from 'actions/views/modals';

import CoreMenuOptions from 'components/advanced_text_editor/send_button/send_post_options/core_menu_options';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import type {RepeatDisabledReason} from 'utils/scheduled_post_repeat';

import ScheduledPostCustomTimeModal from '../scheduled_post_custom_time_modal/scheduled_post_custom_time_modal';
import useRecipientTimezone, {formatUTCOffset} from '../use_recipient_timezone';

import './style.scss';

type Props = {
    channelId: string;
    disabled?: boolean;
    onSelect: (schedulingInfo: SchedulingInfo) => void;
    repeatDisabledReason?: RepeatDisabledReason;
};

export function SendPostOptions({disabled, onSelect, channelId, repeatDisabledReason}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const {
        canUseRecipientTimezone,
        isUsingRecipientTimezone,
        setUseRecipientTimezone,
        recipientTimezone,
    } = useRecipientTimezone(channelId);

    const handleToggleRecipientTimezone = useCallback(() => {
        setUseRecipientTimezone(!isUsingRecipientTimezone);
    }, [setUseRecipientTimezone, isUsingRecipientTimezone]);

    const handleOnSelect = useCallback((e: React.FormEvent, scheduledAt: number) => {
        // Not stopping propagation is load-bearing: in mobile view the menu is a modal that
        // only dismisses once the click reaches the list wrapping the menu items.
        e.preventDefault();

        const schedulingInfo: SchedulingInfo = {
            scheduled_at: scheduledAt,
        };

        onSelect(schedulingInfo);
    }, [onSelect]);

    const handleSelectCustomTime = useCallback((schedulingInfo: SchedulingInfo) => {
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
                repeatDisabledReason,
            },
        }));
    }, [repeatDisabledReason, channelId, dispatch, handleSelectCustomTime]);

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

            {canUseRecipientTimezone && (
                <Menu.Item
                    id='schedule_post_use_recipient_timezone'
                    role='menuitemcheckbox'
                    aria-checked={isUsingRecipientTimezone}
                    className='use-recipient-timezone'
                    onClick={handleToggleRecipientTimezone}
                    leadingElement={
                        <i
                            className={classNames('icon', {
                                'icon-checkbox-marked': isUsingRecipientTimezone,
                                'icon-checkbox-blank-outline': !isUsingRecipientTimezone,
                            })}
                        />
                    }
                    labels={
                        <FormattedMessage
                            id='create_post_button.option.schedule_message.options.use_recipient_timezone'
                            defaultMessage='Use recipient’s timezone ({offset})'
                            values={{offset: formatUTCOffset(recipientTimezone)}}
                        />
                    }
                />
            )}
            {canUseRecipientTimezone && <Menu.Separator/>}

            <CoreMenuOptions
                handleOnSelect={handleOnSelect}
                channelId={channelId}
                isUsingRecipientTimezone={isUsingRecipientTimezone}
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
