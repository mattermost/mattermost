// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PopoverOrigin} from '@mui/material/Popover';
import React from 'react';
import type {ComponentType} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import HeadphonesIcon from '@mattermost/compass-icons/components/headphones';
import PhoneInTalkIcon from '@mattermost/compass-icons/components/phone-in-talk';

import * as Menu from 'components/menu';
import type {MenuButtonComponentProps} from 'components/menu';

import type {DialablePhone} from './use_phone_call_options';

import './call_options_menu.scss';

type Props = {
    menuId: string;
    buttonId: string;
    button: ComponentType<MenuButtonComponentProps>;
    disabled?: boolean;
    phones: DialablePhone[];
    onStartCall: () => void;
    onPhoneCall: (phone: DialablePhone) => void;
    anchorOrigin?: PopoverOrigin;
    transformOrigin?: PopoverOrigin;
};

/**
 * A call button that opens a menu instead of starting a call: a call through the calls plugin,
 * or a phone call to each of the other person's numbers.
 */
const CallOptionsMenu = ({
    menuId,
    buttonId,
    button,
    disabled,
    phones,
    onStartCall,
    onPhoneCall,
    anchorOrigin,
    transformOrigin,
}: Props) => {
    const {formatMessage} = useIntl();
    const ariaLabel = formatMessage({id: 'call_options.aria_label', defaultMessage: 'Call options'});

    return (
        <Menu.Container
            menuButton={{
                id: buttonId,
                as: button,
                'aria-label': ariaLabel,
                disabled,
            }}
            menu={{
                id: menuId,
                'aria-label': ariaLabel,
                className: 'callOptionsMenu',
            }}
            anchorOrigin={anchorOrigin}
            transformOrigin={transformOrigin}
        >
            <Menu.Item
                id={`${menuId}-audio`}
                leadingElement={<HeadphonesIcon size={18}/>}
                labels={
                    <>
                        <span>
                            <FormattedMessage
                                id='call_options.audio'
                                defaultMessage='Start an Audio Call'
                            />
                        </span>
                        <span>
                            <FormattedMessage
                                id='call_options.audio_sub'
                                defaultMessage='Mattermost Call'
                            />
                        </span>
                    </>
                }
                onClick={onStartCall}
            />
            {phones.map((phone) => (
                <Menu.Item
                    key={phone.fieldId}
                    id={`${menuId}-phone-${phone.fieldId}`}
                    leadingElement={<PhoneInTalkIcon size={18}/>}
                    labels={
                        <>
                            <span>
                                <FormattedMessage
                                    id='call_options.phone'
                                    defaultMessage='Call {label}'
                                    values={{label: phone.label}}
                                />
                            </span>
                            <span>
                                <FormattedMessage
                                    id='call_options.phone_sub'
                                    defaultMessage='{number} • Phone call'
                                    values={{number: phone.number}}
                                />
                            </span>
                        </>
                    }
                    onClick={() => onPhoneCall(phone)}
                />
            ))}
        </Menu.Container>
    );
};

export default CallOptionsMenu;
