// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CheckCircleIcon, CheckIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {setStatus} from 'mattermost-redux/actions/users';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import ResetStatusModal from 'components/reset_status_modal';

import {UserStatuses, ModalIdentifiers} from 'utils/constants';

interface Props {
    userId: UserProfile['id'];
    shouldConfirmBeforeStatusChange: boolean;
    isStatusOnline: boolean;
}

export default function UserAccountOnlineMenuItem(props: Props) {
    const dispatch = useDispatch();

    function handleClick() {
        if (props.shouldConfirmBeforeStatusChange) {
            dispatch(openModal({
                modalId: ModalIdentifiers.RESET_STATUS,
                dialogType: ResetStatusModal,
                dialogProps: {
                    newStatus: UserStatuses.ONLINE,
                },
            }));
        } else {
            dispatch(setStatus({
                user_id: props.userId,
                status: UserStatuses.ONLINE,
            }));
        }
    }

    const trailingElement = useMemo(() => {
        if (props.isStatusOnline) {
            return (
                <CheckIcon
                    size={16}
                    className='userAccountMenu_menuItemTrailingCheckIcon'
                    aria-hidden='true'
                />
            );
        }

        return null;
    }, [props.isStatusOnline]);

    return (
        <Menu.Item
            leadingElement={
                <CheckCircleIcon
                    size='18'
                    className='userAccountMenu_onlineMenuItem_icon'
                    aria-hidden='true'
                />
            }
            labels={
                <FormattedMessage
                    id='userAccountMenu.onlineMenuItem.label'
                    defaultMessage='Online'
                />
            }
            trailingElements={trailingElement}
            aria-checked={props.isStatusOnline}
            onClick={handleClick}
        />
    );
}
