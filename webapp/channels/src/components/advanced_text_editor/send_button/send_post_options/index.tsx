// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import type Constants from 'utils/constants';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';

import * as Menu from 'components/menu';

import './style.scss';

type Props = {
    disabled?: boolean;
}

export function SendPostOptions({disabled}: Props) {
    const {formatMessage} = useIntl();

    return (
        <Menu.Container
            hideTooltipWhenDisabled={true}
            menuButtonTooltip={{
                id: 'send_post_option_schedule_post',
                text: formatMessage({id: 'create_post_button.option.schedule_message', defaultMessage: 'Schedule message'}),
            }}
            menuButton={{
                id: 'button_send_post_options',
                class: classNames('button_send_post_options', {disabled}),
                children: <ChevronDownIcon size={16}/>,
                disabled,
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
                        defaultMessage={'Scheduled message'}
                    />
                }
            />

            <Menu.Item
                labels={
                    <FormattedMessage
                        id='post_info.reply'
                        defaultMessage='Reply'
                    />
                }
            />

            <Menu.Item
                labels={
                    <FormattedMessage
                        id='post_info.reply'
                        defaultMessage='Reply'
                    />
                }
            />
        </Menu.Container>
    );
}
