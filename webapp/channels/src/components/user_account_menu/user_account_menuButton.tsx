// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import type {MouseEvent, KeyboardEvent} from 'react';
import {defineMessages} from 'react-intl';

import {CheckCircleIcon, ClockIcon, MinusCircleIcon, RadioboxBlankIcon} from '@mattermost/compass-icons/components';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import Avatar from 'components/widgets/users/avatar/avatar';

import {UserStatuses} from 'utils/constants';

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
    const statusIcon = useMemo(() => {
        if (status && status === UserStatuses.ONLINE) {
            return (
                <CheckCircleIcon
                    size='16'
                    className='userAccountMenu_onlineMenuItem_icon'
                />
            );
        }

        if (status && status === UserStatuses.AWAY) {
            return (
                <ClockIcon
                    size='16'
                    className='userAccountMenu_awayMenuItem_icon'
                />
            );
        }

        if (status && status === UserStatuses.DND) {
            return (
                <MinusCircleIcon
                    size='16'
                    className='userAccountMenu_dndMenuItem_icon'
                />
            );
        }

        if (status && status === UserStatuses.OFFLINE) {
            return (
                <RadioboxBlankIcon
                    size='16'
                    className='userAccountMenu_offlineMenuItem_icon'
                />
            );
        }

        return (
            <ClockIcon
                size='16'
                className='userAccountMenu_awayMenuItem_icon'
            />
        );
    }, [status]);

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
                {statusIcon}
            </div>
        </>
    );
}

const ariaLabelsDefineMessages = defineMessages({
    outOfOffice: {
        id: 'userAccountMenu.menuButton.ariaLabel.ooo',
        defaultMessage: 'Status is "Out of office". Open user\'s account menu.',
    },
    online: {
        id: 'userAccountMenu.menuButton.ariaLabel.online',
        defaultMessage: 'Status is "Online". Open user\'s account menu.',
    },
    away: {
        id: 'userAccountMenu.menuButton.ariaLabel.away',
        defaultMessage: 'Status is "Away". Open user\'s account menu.',
    },
    dnd: {
        id: 'userAccountMenu.menuButton.ariaLabel.dnd',
        defaultMessage: 'Status is "Do not disturb". Open user\'s account menu.',
    },
    offline: {
        id: 'userAccountMenu.menuButton.ariaLabel.offline',
        defaultMessage: 'Status is "Offline". Open user\'s account menu.',
    },
    notSet: {
        id: 'userAccountMenu.menuButton.ariaLabel',
        defaultMessage: 'Open user\'s account menu.',
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
