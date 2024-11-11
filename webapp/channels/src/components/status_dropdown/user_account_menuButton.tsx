// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {defineMessages} from 'react-intl';

import StatusIcon from '@mattermost/compass-components/components/status-icon';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import Avatar from 'components/widgets/users/avatar/avatar';

import {UserStatuses} from 'utils/constants';

interface Props {
    profilePicture?: string;
    openCustomStatusModal: ((event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => void);
    status?: string;
}

export default function UserAccountMenuButton(props: Props) {
    return (
        <>
            <CustomStatusEmoji
                showTooltip={true}
                tooltipDirection={'bottom'}
                emojiStyle={{marginRight: '6px'}}
                aria-hidden={true}
                onClick={props.openCustomStatusModal}
            />
            {
                props.profilePicture && (
                    <Avatar
                        size='sm'
                        url={props.profilePicture}
                        aria-hidden={true}
                    />
                )
            }
            <div
                className='status'
            >
                <StatusIcon
                    size={'sm'}
                    status={(props.status || 'offline')}
                    aria-hidden={true}
                />
            </div>
        </>
    );
}

const ariaLabelsDefineMessages = defineMessages({
    outOfOffice: {
        id: 'status_dropdown.profile_button_label.ooo',
        defaultMessage: 'Current status is "Out of office". Click to open user account menu.',
    },
    online: {
        id: 'status_dropdown.profile_button_label.online',
        defaultMessage: 'Current status is "Online". Click to open user account menu.',
    },
    away: {
        id: 'status_dropdown.profile_button_label.away',
        defaultMessage: 'Current status is "Away". Click to open user account menu.',
    },
    dnd: {
        id: 'status_dropdown.profile_button_label.dnd',
        defaultMessage: 'Current status is "Do not disturb". Click to open user account menu.',
    },
    offline: {
        id: 'status_dropdown.profile_button_label.offline',
        defaultMessage: 'Current status is "Offline". Click to open user account menu.',
    },
    notSet: {
        id: 'status_dropdown.profile_button_label',
        defaultMessage: 'Click to open user account menu.',
    },
});

export function getMenuButtonAriaLabel(status?: string) {
    let ariaLabel;
    switch (status) {
    case UserStatuses.OUT_OF_OFFICE:
        ariaLabel = ariaLabelsDefineMessages.outOfOffice;
        break;
    case UserStatuses.ONLINE:
        ariaLabel = ariaLabelsDefineMessages.online;
        break;
    case UserStatuses.AWAY:
        ariaLabel = ariaLabelsDefineMessages.away;
        break;
    case UserStatuses.DND:
        ariaLabel = ariaLabelsDefineMessages.dnd;
        break;
    case UserStatuses.OFFLINE:
        ariaLabel = ariaLabelsDefineMessages.offline;
        break;
    default:
        ariaLabel = ariaLabelsDefineMessages.notSet;
    }

    return ariaLabel;
}
