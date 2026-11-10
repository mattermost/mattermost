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
    const ariaLabel = formatMessage({
        id: 'call_options.aria_label',
        defaultMessage: 'Call options',
        description: 'Accessible label for the call button, and the menu it opens, offering ways to call a user from a DM channel header or their profile popover.',
    });

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
                                description='Call options menu item that starts a voice call through the Mattermost Calls plugin.'
                            />
                        </span>
                        <span>
                            <FormattedMessage
                                id='call_options.audio_sub'
                                defaultMessage='Mattermost Call'
                                description='Secondary line under the call options menu item that starts an audio call, naming it as a call made within Mattermost rather than a phone call.'
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
                                    description='Call options menu item that phones the user on one of their numbers; {label} is the name of the profile attribute holding the number, such as "Mobile" or "Work phone".'
                                    values={{label: phone.label}}
                                />
                            </span>
                            <span>
                                <FormattedMessage
                                    id='call_options.phone_sub'
                                    defaultMessage='{number} • Phone call'
                                    description='Secondary line under a call options menu item that phones the user; {number} is the phone number that will be dialed.'
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
