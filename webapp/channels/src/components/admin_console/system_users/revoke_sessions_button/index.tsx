// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {revokeSessionsForAllUsers} from 'mattermost-redux/actions/users';
import {Permissions} from 'mattermost-redux/constants';

import {emitUserLoggedOutEvent} from 'actions/global_actions';

import ConfirmModal from 'components/confirm_modal';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

export function RevokeSessionsButton() {
    const dispatch = useDispatch();

    const [showModal, setShowModal] = useState(false);

    function handleModalToggle() {
        setShowModal((showModal) => !showModal);
    }

    async function handleModalConfirm() {
        const {data} = await dispatch(revokeSessionsForAllUsers());

        if (data) {
            emitUserLoggedOutEvent();
        } else {
            setShowModal(false);
        }
    }

    return (
        <SystemPermissionGate permissions={[Permissions.REVOKE_USER_ACCESS_TOKEN]}>
            <button
                className='btn btn-tertiary btn-danger'
                onClick={handleModalToggle}
            >
                <FormattedMessage
                    id='admin.system_users.revokeAllSessions'
                    defaultMessage='Revoke All Sessions'
                />
            </button>
            <ConfirmModal
                show={showModal}
                title={
                    <FormattedMessage
                        id='admin.system_users.revoke_all_sessions_modal_title'
                        defaultMessage='Revoke all sessions in the system'
                    />
                }
                message={
                    <FormattedMessage
                        id='admin.system_users.revoke_all_sessions_modal_message'
                        defaultMessage='This action revokes all sessions in the system. All users will be logged out from all devices, including your session. Are you sure you want to revoke all sessions?'
                    />
                }
                confirmButtonClass='btn btn-danger'
                confirmButtonText={
                    <FormattedMessage
                        id='admin.system_users.revoke_all_sessions_button'
                        defaultMessage='Revoke All Sessions'
                    />
                }
                onConfirm={handleModalConfirm}
                onCancel={handleModalToggle}
            />
        </SystemPermissionGate>
    );
}
