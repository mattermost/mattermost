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

export default function UserAccountMenuButton(props: Props) {
    const statusIcon = useMemo(() => {
        if (props.status && props.status === UserStatuses.ONLINE) {
            return (
                <CheckCircleIcon
                    size='16'
                    className='userAccountMenu_onlineMenuItem_icon'
                />
            );
        }

        if (props.status && props.status === UserStatuses.AWAY) {
            return (
                <ClockIcon
                    size='16'
                    className='userAccountMenu_awayMenuItem_icon'
                />
            );
        }

        if (props.status && props.status === UserStatuses.DND) {
            return (
                <MinusCircleIcon
                    size='16'
                    className='userAccountMenu_dndMenuItem_icon'
                />
            );
        }

        if (props.status && props.status === UserStatuses.OFFLINE) {
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
    }, [props.status]);

    return (
        <>
            <CustomStatusEmoji
                showTooltip={true}
                tooltipDirection={'bottom'}
                emojiStyle={{marginRight: '6px'}}
                aria-hidden={true}
                onClick={props.openCustomStatusModal}
            />
            <Avatar
                size='sm'
                url={props.profilePicture}
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
        defaultMessage: 'Current status is "Out of office". Click to open user account menu.',
    },
    online: {
        id: 'userAccountMenu.menuButton.ariaLabel.online',
        defaultMessage: 'Current status is "Online". Click to open user account menu.',
    },
    away: {
        id: 'userAccountMenu.menuButton.ariaLabel.away',
        defaultMessage: 'Current status is "Away". Click to open user account menu.',
    },
    dnd: {
        id: 'userAccountMenu.menuButton.ariaLabel.dnd',
        defaultMessage: 'Current status is "Do not disturb". Click to open user account menu.',
    },
    offline: {
        id: 'userAccountMenu.menuButton.ariaLabel.offline',
        defaultMessage: 'Current status is "Offline". Click to open user account menu.',
    },
    notSet: {
        id: 'userAccountMenu.menuButton.ariaLabel',
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
