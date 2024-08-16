// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';

import * as Menu from 'components/menu';

import './style.scss';
import Timestamp from 'components/timestamp';

type Props = {
    disabled?: boolean;
}

export function SendPostOptions({disabled}: Props) {
    const {formatMessage} = useIntl();

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

        const optionTomorrow = (
            <Menu.Item
                labels={
                    <FormattedMessage
                        id='create_post_button.option.schedule_message.options.tomorrow'
                        defaultMessage='Tomorrow at {9amTime}'
                        values={{'9amTime': timeComponent}}
                    />
                }
            />
        );

        const optionNextMonday = (
            <Menu.Item
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

        const options: React.ReactElement[] = [];

        switch (today.getDay()) {
        // Sunday
        case 0:
            options.push(optionTomorrow);
            break;

        // Monday
        case 1:
            options.push(optionTomorrow, optionNextMonday);
            break;

        // Friday and Saturday
        case 5:
        case 6:
            options.push(optionMonday);
            break;

        // Tuesday to Thursday
        default:
            options.push(optionTomorrow, optionMonday);
        }

        return options;
    }, []);

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
