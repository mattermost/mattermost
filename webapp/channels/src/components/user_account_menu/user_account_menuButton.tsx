// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {defineMessages, useIntl} from 'react-intl';

import {StatusBadge} from '@mattermost/compass-ui/components/status-badge';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import Avatar from 'components/widgets/users/avatar/avatar';

import {UserStatuses} from 'utils/constants';
import {getStatusBadgeProps} from 'utils/status_badge';

interface Props {
    profilePicture?: string;
    openCustomStatusModal: ((event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void);
    status?: string;
}

export default function UserAccountMenuButton({
    profilePicture,
    openCustomStatusModal,
    status,
}: Props) {
    const {formatMessage} = useIntl();
    const statusBadgeProps = getStatusBadgeProps(status || UserStatuses.OFFLINE, formatMessage);

    return (
        <>
            <CustomStatusEmoji
                showTooltip={true}
                emojiStyle={{marginRight: '6px'}}
                aria-hidden={true}
                onClick={openCustomStatusModal}
            />
            <Avatar
                size='sm'
                url={profilePicture}
                aria-hidden={true}
            />
            <div
                className='userStatusIconWrapper'
                aria-hidden={true}
            >
                {statusBadgeProps && (
                    <StatusBadge
                        className={`userAccountMenu_statusBadge userAccountMenu_statusBadge--${statusBadgeProps.status}`}
                        {...statusBadgeProps}
                    />
                )}
            </div>
            <p
                id='userAccountMenuButtonDescribedBy'
                className='sr-only'
            >
                {formatMessage(getMenuButtonAriaDescription(status))}
            </p>
        </>
    );
}

const ariaDescriptionsDefineMessages = defineMessages({
    outOfOffice: {
        id: 'userAccountMenu.menuButton.ariaDescription.ooo',
        defaultMessage: 'Status is "Out of office".',
    },
    online: {
        id: 'userAccountMenu.menuButton.ariaDescription.online',
        defaultMessage: 'Status is "Online".',
    },
    away: {
        id: 'userAccountMenu.menuButton.ariaDescription.away',
        defaultMessage: 'Status is "Away".',
    },
    dnd: {
        id: 'userAccountMenu.menuButton.ariaDescription.dnd',
        defaultMessage: 'Status is "Do not disturb".',
    },
    offline: {
        id: 'userAccountMenu.menuButton.ariaDescription.offline',
        defaultMessage: 'Status is "Offline".',
    },
});

function getMenuButtonAriaDescription(status?: string) {
    let ariaLabel;
    switch (status) {
    case UserStatuses.OUT_OF_OFFICE:
        ariaLabel = ariaDescriptionsDefineMessages.outOfOffice;
        break;
    case UserStatuses.ONLINE:
        ariaLabel = ariaDescriptionsDefineMessages.online;
        break;
    case UserStatuses.AWAY:
        ariaLabel = ariaDescriptionsDefineMessages.away;
        break;
    case UserStatuses.DND:
        ariaLabel = ariaDescriptionsDefineMessages.dnd;
        break;
    case UserStatuses.OFFLINE:
    default:
        ariaLabel = ariaDescriptionsDefineMessages.offline;
        break;
    }

    return ariaLabel;
}
