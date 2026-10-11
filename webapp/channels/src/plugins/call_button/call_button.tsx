// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useEffect, useRef} from 'react';
import type {CSSProperties} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import PhoneIcon from '@mattermost/compass-icons/components/phone';
import {Button} from '@mattermost/compass-ui/components/button';
import {Icon} from '@mattermost/compass-ui/components/icon';
import type {Channel, ChannelMembership} from '@mattermost/types/channels';

import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {getUserIdFromChannelName, isDirectChannel} from 'mattermost-redux/utils/channel_utils';

import {getSessionsInCalls} from 'selectors/calls';

import type {DialablePhone} from 'components/call_options_menu';
import CallOptionsMenu, {useCanStartCall, usePhoneCallOptions} from 'components/call_options_menu';
import type {MenuButtonComponentProps} from 'components/menu';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {Constants} from 'utils/constants';

import type {GlobalState} from 'types/store';
import type {CallButtonAction} from 'types/store/plugins';

import './call_button.scss';

type Props = {
    currentChannel?: Channel;
    channelMember?: ChannelMembership;
    pluginCallComponents: CallButtonAction[];
    sidebarOpen: boolean;
};

export default function CallButton({pluginCallComponents, currentChannel, channelMember, sidebarOpen}: Props) {
    const [active, setActive] = useState(false);
    const [clickEnabled, setClickEnabled] = useState(true);
    const prevSidebarOpen = useRef(sidebarOpen);
    const {formatMessage} = useIntl();

    // In a DM with someone who has a phone number, the button opens a menu offering a call or a
    // phone call. That needs a single call plugin that can dial, and no call already going on.
    const currentUserId = useSelector(getCurrentUserId);
    const singleCallButton = pluginCallComponents.length === 1 ? pluginCallComponents[0] : undefined;
    const isOpenDM = Boolean(currentChannel && isDirectChannel(currentChannel) && !currentChannel.delete_at);
    const dmUserId = isOpenDM && currentChannel ? getUserIdFromChannelName(currentUserId, currentChannel.name) : undefined;
    const mayOfferPhone = Boolean(singleCallButton?.phoneAction && dmUserId);
    const callOngoing = useSelector((state: GlobalState) => mayOfferPhone && Object.keys(getSessionsInCalls(state)[currentChannel?.id ?? ''] ?? {}).length > 0);
    const canCall = useCanStartCall(currentChannel?.id ?? '', currentUserId, mayOfferPhone);
    const phones = usePhoneCallOptions(dmUserId, mayOfferPhone && canCall && !callOngoing);

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

    function handleStartCall() {
        singleCallButton?.action?.(currentChannel, channelMember);
    }

    function handlePhoneCall(phone: DialablePhone) {
        singleCallButton?.phoneAction?.({number: phone.number, userId: dmUserId ?? '', label: phone.label, fieldId: phone.fieldId});
    }

    if (singleCallButton?.phoneAction && dmUserId && phones.length > 0) {
        return (
            <div
                style={style.container}
                className='flex-child'
            >
                <CallOptionsMenu
                    menuId='callOptionsMenu'
                    buttonId='callOptionsButton'
                    button={StartCallMenuButton}
                    disabled={!clickEnabled}
                    phones={phones}
                    onStartCall={handleStartCall}
                    onPhoneCall={handlePhoneCall}
                    anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
                    transformOrigin={{vertical: 'top', horizontal: 'right'}}
                />
            </div>
        );
    }

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
                    <PhoneIcon
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

const StartCallMenuButton = (props: MenuButtonComponentProps) => (
    <Button
        {...props}
        emphasis='quaternary'
        size='small'
        leadingIcon={<Icon glyph={<PhoneIcon/>}/>}
        trailingIcon={<Icon glyph={<ChevronDownIcon/>}/>}
    >
        <FormattedMessage
            id='call_button.start_call'
            defaultMessage='Start call'
        />
    </Button>
);
