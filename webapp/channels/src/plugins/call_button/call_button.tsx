// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, useRef} from 'react';
import type {CSSProperties} from 'react';
import {useIntl} from 'react-intl';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import PhoneOutlineIcon from '@mattermost/compass-icons/components/phone-outline';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';

import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {Constants} from 'utils/constants';

import type {PluginComponent} from 'types/store/plugins';

import './call_button.scss';

type Props = {
    currentChannel: Channel;
    channelMember?: ChannelMembership;
    pluginCallComponents: PluginComponent[];
    sidebarOpen: boolean;
}

export default function CallButton({pluginCallComponents, currentChannel, channelMember, sidebarOpen}: Props) {
    const [active, setActive] = useState(false);
    const [clickEnabled, setClickEnabled] = useState(true);
    const prevSidebarOpen = useRef(sidebarOpen);
    const {formatMessage} = useIntl();

    useEffect(() => {
        if (prevSidebarOpen.current && !sidebarOpen) {
            setClickEnabled(false);
            setTimeout(() => {
                setClickEnabled(true);
            }, Constants.CHANNEL_HEADER_BUTTON_DISABLE_TIMEOUT);
        }
        prevSidebarOpen.current = sidebarOpen;
    }, [sidebarOpen]);

    if (pluginCallComponents.length === 0) {
        return null;
    }

    const style = {
        container: {
            marginTop: 16,
            height: 32,
        } as CSSProperties,
    };

    if (pluginCallComponents.length === 1) {
        const item = pluginCallComponents[0];
        const clickHandler = () => item.action?.(currentChannel, channelMember);

        return (
            <div
                style={style.container}
                className='flex-child'
                onClick={clickEnabled ? clickHandler : undefined}
                onTouchEnd={clickEnabled ? clickHandler : undefined}
            >
                {item.button}
            </div>
        );
    }

    const items = pluginCallComponents.map((item) => {
        return (
            <li
                className='MenuItem'
                key={item.id}
                onClick={(e) => {
                    e.preventDefault();
                    item.action?.(currentChannel, channelMember);
                }}
            >
                {item.dropdownButton}
            </li>
        );
    });

    return (
        <div
            style={style.container}
            className='flex-child'
        >
            <MenuWrapper onToggle={(toggle: boolean) => setActive(toggle)}>
                <button className={classNames('style--none call-button dropdown', {active})}>
                    <PhoneOutlineIcon
                        color='inherit'
                        aria-label={formatMessage({id: 'generic_icons.call', defaultMessage: 'Call icon'}).toLowerCase()}
                    />
                    <span className='call-button-label'>{'Call'}</span>
                    <ChevronDownIcon
                        color='inherit'
                        aria-label={formatMessage({id: 'generic_icons.dropdown', defaultMessage: 'Dropdown Icon'}).toLowerCase()}
                    />
                </button>
                <Menu
                    id='callOptions'
                    ariaLabel={formatMessage({id: 'call_button.menuAriaLabel', defaultMessage: 'Call type selector'})}
                    customStyles={{
                        top: 'auto',
                        left: 'auto',
                        right: 0,
                    }}
                >
                    {items}
                </Menu>
            </MenuWrapper>
        </div>
    );
}
