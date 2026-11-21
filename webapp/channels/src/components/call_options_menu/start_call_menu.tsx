// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ReactNode} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import CogOutlineIcon from '@mattermost/compass-icons/components/cog-outline';
import LinkVariantIcon from '@mattermost/compass-icons/components/link-variant';
import PhoneIcon from '@mattermost/compass-icons/components/phone';
import PhoneOutlineIcon from '@mattermost/compass-icons/components/phone-outline';
import {Icon} from '@mattermost/compass-ui/components/icon';

import * as Menu from 'components/menu';
import {createMenuIconButtonTrigger} from 'components/menu';

import type {DialablePhone} from './use_phone_call_options';

import './call_options_menu.scss';

type Props = {
    menuId: string;
    buttonId: string;
    disabled?: boolean;
    phones: DialablePhone[];
    onStartCall: () => void;
    onPhoneCall: (phone: DialablePhone) => void;
    onCopyCallLink?: () => void;
    onOpenCallSettings?: () => void;
};

/**
 * The call button in a DM header or profile popover when no call is going on: a menu to start a Mattermost call,
 * copy a call link, phone the other person on one of their numbers, or open call settings.
 */
const StartCallMenu = ({
    menuId,
    buttonId,
    disabled,
    phones,
    onStartCall,
    onPhoneCall,
    onCopyCallLink,
    onOpenCallSettings,
}: Props) => {
    const {formatMessage} = useIntl();
    const label = formatMessage({
        id: 'start_call_menu.button',
        defaultMessage: 'Start call',
        description: 'Accessible name and tooltip of the icon-only call button in a DM channel header or profile popover, which opens a menu of ways to call the other person.',
    });

    // Group headings only make sense when there is more than one group.
    const showHeadings = phones.length > 0;
    const mattermostHeadingId = `${menuId}-mattermostCallHeading`;
    const phoneHeadingId = `${menuId}-phoneCallHeading`;
    const mattermostDescribedBy = showHeadings ? mattermostHeadingId : undefined;

    return (
        <Menu.Container
            menuButton={{
                id: buttonId,
                as: StartCallMenuButton,
                'aria-label': label,
                disabled,
                children: startCallMenuButtonIcons,
            }}
            menuButtonTooltip={{text: label}}
            menu={{
                id: menuId,
                'aria-label': label,
                className: 'startCallMenu',
            }}
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
        >
            {showHeadings && (
                <GroupHeading id={mattermostHeadingId}>
                    <FormattedMessage
                        id='start_call_menu.mattermost_call'
                        defaultMessage='Mattermost call'
                        description='Heading of the Start call menu group with ways to call someone within Mattermost, shown when the menu also has a phone call group.'
                    />
                </GroupHeading>
            )}
            <Menu.Item
                id={`${menuId}-startCall`}
                aria-describedby={mattermostDescribedBy}
                leadingElement={<PhoneIcon size={18}/>}
                labels={
                    <FormattedMessage
                        id='start_call_menu.start_call'
                        defaultMessage='Start call'
                        description='Start call menu item that starts a call with the other person through the Mattermost Calls plugin.'
                    />
                }
                onClick={onStartCall}
            />
            {onCopyCallLink && (
                <Menu.Item
                    id={`${menuId}-copyCallLink`}
                    aria-describedby={mattermostDescribedBy}
                    leadingElement={<LinkVariantIcon size={18}/>}
                    labels={
                        <FormattedMessage
                            id='start_call_menu.copy_call_link'
                            defaultMessage='Copy call link'
                            description='Start call menu item that copies a link to a call with the other person, without starting the call.'
                        />
                    }
                    onClick={onCopyCallLink}
                />
            )}
            {showHeadings && <Menu.Separator/>}
            {showHeadings && (
                <GroupHeading id={phoneHeadingId}>
                    <FormattedMessage
                        id='start_call_menu.phone_call'
                        defaultMessage='Phone call'
                        description='Heading of the Start call menu group listing the phone numbers the other person can be called on.'
                    />
                </GroupHeading>
            )}
            {phones.map((phone) => (
                <Menu.Item
                    key={phone.fieldId}
                    id={`${menuId}-phone-${phone.fieldId}`}
                    aria-describedby={phoneHeadingId}
                    leadingElement={<PhoneOutlineIcon size={18}/>}
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
                            <span>{phone.number}</span>
                        </>
                    }
                    onClick={() => onPhoneCall(phone)}
                />
            ))}
            {onOpenCallSettings && <Menu.Separator/>}
            {onOpenCallSettings && (
                <Menu.Item
                    id={`${menuId}-callSettings`}
                    leadingElement={<CogOutlineIcon size={18}/>}
                    labels={
                        <FormattedMessage
                            id='start_call_menu.call_settings'
                            defaultMessage='Call settings'
                            description='Last item of the Start call menu, which opens the Calls tab of the user settings.'
                        />
                    }
                    onClick={onOpenCallSettings}
                />
            )}
        </Menu.Container>
    );
};

const GroupHeading = ({id, children}: {id: string; children: ReactNode}) => (
    <Menu.Title role='presentation'>
        <span id={id}>{children}</span>
    </Menu.Title>
);

// Keeps MUI from trying to focus the heading, instead of the first item, when the menu opens.
GroupHeading.muiSkipListHighlight = true;

const StartCallMenuButton = createMenuIconButtonTrigger({size: 'small', className: 'StartCallMenuButton'});

const startCallMenuButtonIcons = (
    <>
        <Icon glyph={<PhoneIcon/>}/>
        <Icon
            className='StartCallMenuButton__chevron'
            size='12'
            glyph={<ChevronDownIcon/>}
        />
    </>
);

export default StartCallMenu;
