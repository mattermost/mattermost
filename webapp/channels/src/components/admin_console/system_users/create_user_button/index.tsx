// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/shared/components/button';

import {Permissions} from 'mattermost-redux/constants';

import {openModal} from 'actions/views/modals';

import CreateUserModal from 'components/admin_console/create_user_modal';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

import {ModalIdentifiers} from 'utils/constants';

export function CreateUserButton() {
    const dispatch = useDispatch();

    const handleClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CREATE_USER_MODAL,
            dialogType: CreateUserModal,
        }));
    }, [dispatch]);

    return (
        <SystemPermissionGate permissions={[Permissions.SYSCONSOLE_WRITE_USERMANAGEMENT_USERS]}>
            <Button
                emphasis='primary'
                onClick={handleClick}
                data-testid='createUserButton'
            >
                <FormattedMessage
                    id='admin.system_users.createUser'
                    defaultMessage='Create User'
                />
            </Button>
        </SystemPermissionGate>
    );
}
