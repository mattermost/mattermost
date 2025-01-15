// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CheckIcon, ClockIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {setStatus} from 'mattermost-redux/actions/users';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import ResetStatusModal from 'components/reset_status_modal';

import {ModalIdentifiers, UserStatuses} from 'utils/constants';

interface Props {
    userId: UserProfile['id'];
    shouldConfirmBeforeStatusChange: boolean;
    isStatusAway: boolean;
}

export default function UserAccountAwayMenuItem(props: Props) {
    const dispatch = useDispatch();

    function handleClick() {
        if (props.shouldConfirmBeforeStatusChange) {
            dispatch(openModal({
                modalId: ModalIdentifiers.RESET_STATUS,
                dialogType: ResetStatusModal,
                dialogProps: {
                    newStatus: UserStatuses.AWAY,
                },
            }));
        } else {
            dispatch(setStatus({
                user_id: props.userId,
                status: UserStatuses.AWAY,
            }));
        }
    }

    const trailingElement = useMemo(() => {
        if (props.isStatusAway) {
            return (
                <CheckIcon
                    size={16}
                    className='userAccountMenu_menuItemTrailingCheckIcon'
                    aria-hidden='true'
                />
            );
        }

        return null;
    }, [props.isStatusAway]);

    return (
        <Menu.Item
            leadingElement={
                <ClockIcon
                    size='18'
                    className='userAccountMenu_awayMenuItem_icon'
                    aria-hidden='true'
                />
            }
            labels={
                <FormattedMessage
                    id='userAccountMenu.awayMenuItem.label'
                    defaultMessage='Away'
                />
            }
            trailingElements={trailingElement}
            aria-checked={props.isStatusAway}
            onClick={handleClick}
        />
    );
}
