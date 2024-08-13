// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import type Constants from 'utils/constants';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';

import * as Menu from 'components/menu';

import './style.scss';

type Props = {
    location?: keyof typeof Constants.Locations;
    disabled?: boolean;
}

export function SendPostOptions({location, disabled}: Props) {
    return (
        <Menu.Container
            menuButton={{
                id: 'button_send_post_options',
                class: classNames('button_send_post_options', {disabled}),
                children: <ChevronDownIcon size={16}/>,
                disabled,
            }}
            menu={{
                id: `${location}_dropdown_send_post_options`,
            }}
        >
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='post_info.reply'
                        defaultMessage='Reply'
                    />
                }
            >
                <p>{'Hello!!!'}</p>
            </Menu.Item>

            <Menu.Item
                labels={
                    <FormattedMessage
                        id='post_info.reply'
                        defaultMessage='Reply'
                    />
                }
            >
                <p>{'World!!!'}</p>
            </Menu.Item>
        </Menu.Container>
    );
}
