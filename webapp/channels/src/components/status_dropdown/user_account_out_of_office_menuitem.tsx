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

interface Props {
    userId: UserProfile['id'];
    status?: UserProfile['status'];
    autoResetPref?: string;
}

export default function UserAccountOutOfOfficeMenuItem(props: Props) {
    const dispatch = useDispatch();

    if (!props.status) {
        return null;
    }

    if (props.status !== UserStatuses.OUT_OF_OFFICE) {
        return null;
    }

    function handleClick() {
        if (props.autoResetPref === '') {
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
        <>
            <Menu.Item
                leadingElement={<CancelIcon size={18}/>}
                labels={
                    <>
                        <FormattedMessage
                            id='userAccountPopover.menuItem.ooo.primaryLabel'
                            defaultMessage='Out of office'
                        />
                        <FormattedMessage
                            id='userAccountPopover.menuItem.ooo.secondaryLabel'
                            defaultMessage='Automatic replies are enabled'
                        />
                    </>
                }
                trailingElements={
                    <CheckIcon
                        size={16}
                        color={'var(--button-bg)'}
                    />

                }
                onClick={handleClick}
            />
            <Menu.Separator/>
        </>
    );
}
