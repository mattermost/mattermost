// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CancelIcon, CheckIcon} from '@mattermost/compass-icons/components';
import type {UserProfile} from '@mattermost/types/users';

import {setStatus} from 'mattermost-redux/actions/users';

import {openModal} from 'actions/views/modals';

import * as Menu from 'components/menu';
import ResetStatusModal from 'components/reset_status_modal';

import {UserStatuses, ModalIdentifiers} from 'utils/constants';

export interface Props {
    userId: UserProfile['id'];
    shouldConfirmBeforeStatusChange: boolean;
}

export default function UserAccountOutOfOfficeMenuItem(props: Props) {
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

    return (
        <Menu.Item
            leadingElement={
                <CancelIcon
                    size={18}
                    aria-hidden='true'
                />
            }
            labels={
                <>
                    <FormattedMessage
                        id='userAccountMenu.oooMenuItem.primaryLabel'
                        defaultMessage='Out of office'
                    />
                    <FormattedMessage
                        id='userAccountMenu.oooMenuItem.secondaryLabel'
                        defaultMessage='Automatic replies are enabled'
                    />
                </>
            }
            trailingElements={
                <CheckIcon
                    size={16}
                    className='userAccountMenu_menuItemTrailingCheckIcon'
                    aria-hidden='true'
                />
            }
            aria-checked='true'
            onClick={handleClick}
        />
    );
}
