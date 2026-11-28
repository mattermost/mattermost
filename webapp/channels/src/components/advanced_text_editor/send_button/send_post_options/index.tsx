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
import DisabledReasonTooltip from 'components/common/disabled_reason_tooltip';
import * as Menu from 'components/menu';

import {ModalIdentifiers} from 'utils/constants';
import type {RepeatDisabledReason} from 'utils/scheduled_post_repeat';

import ScheduledPostCustomTimeModal from '../scheduled_post_custom_time_modal/scheduled_post_custom_time_modal';

import './style.scss';

type Props = {
    channelId: string;
    disabled?: boolean;
    onSelect: (schedulingInfo: SchedulingInfo) => Promise<{error?: string}>;
    repeatDisabledReason?: RepeatDisabledReason;

    // When set, the chevron is disabled and this says why. Unlike `disabled`, which
    // suppresses the tooltip along with the button, the reason stays visible: a natively
    // disabled button receives no hover or focus events, so it is shown from a focusable
    // wrapper around the button.
    blockedReason?: string;

    /** The composer's scope for this button (`<testId>.open_menu--button`); the center and thread composers each have one. */
    testId?: string;
};

export function SendPostOptions({disabled, onSelect, channelId, repeatDisabledReason, blockedReason, testId}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const handleOnSelect = useCallback((e: React.FormEvent, scheduledAt: number) => {
        // Not stopping propagation is load-bearing: in mobile view the menu is a modal that
        // only dismisses once the click reaches the list wrapping the menu items.
        e.preventDefault();

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
                onConfirm: onSelect,
                repeatDisabledReason,
            },
        }));
    }, [repeatDisabledReason, channelId, dispatch, onSelect]);

    const buttonDisabled = Boolean(disabled || blockedReason);

    const menu = (
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
                testId: testId ? `${testId}.open_menu` : undefined,
                class: classNames('button_send_post_options', {disabled: buttonDisabled}),
                children: <ChevronDownIcon size={16}/>,
                disabled: buttonDisabled,
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

            <CoreMenuOptions
                handleOnSelect={handleOnSelect}
                channelId={channelId}
            />

            <Menu.Separator/>

            <Menu.Item
                data-testid='send_post_options.menu.custom_time--menuitem'
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

    if (!blockedReason) {
        return menu;
    }

    return (
        <DisabledReasonTooltip
            reason={blockedReason}
            className='send_post_options_blocked'
        >
            {menu}
        </DisabledReasonTooltip>
    );
}
