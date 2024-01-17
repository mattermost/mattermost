// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {updateUserActive} from 'mattermost-redux/actions/users';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {isSystemAdmin, isGuest} from 'mattermost-redux/utils/user_utils';

import {adminResetMfa} from 'actions/admin_actions';
import {openModal} from 'actions/views/modals';

import ManageRolesModal from 'components/admin_console/manage_roles_modal';
import ManageTeamsModal from 'components/admin_console/manage_teams_modal';
import ManageTokensModal from 'components/admin_console/manage_tokens_modal';
import ResetEmailModal from 'components/admin_console/reset_email_modal';
import ResetPasswordModal from 'components/admin_console/reset_password_modal';
import * as Menu from 'components/menu';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';

import Constants, {ModalIdentifiers} from 'utils/constants';

import CreateGroupSyncablesMembershipsModal from './create_group_syncables_membership_modal';
import DeactivateMemberModal from './deactivate_member_modal';
import DemoteToGuestModal from './demote_to_guest_modal';
import PromoteToMemberModal from './promote_to_member_modal';
import RevokeSessionsModal from './revoke_sessions_modal';

interface Props {
    user: UserProfile;
    currentUser: UserProfile;
    tableId?: string;
    rowIndex: number;
    onError: (error: ServerError) => void;
}

export function SystemUsersListAction({user, currentUser, tableId, rowIndex, onError}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const config = useSelector(getConfig);
    const isLicensed = useSelector(getLicense)?.IsLicensed === 'true';

    function getTranslatedUserRole(userRoles: UserProfile['roles']) {
        if (user.roles.length > 0 && isSystemAdmin(userRoles)) {
            return (
                <FormattedMessage
                    id='admin.system_users.list.actions.userAdmin'
                    defaultMessage='System Admin'
                />
            );
        } else if (isGuest(userRoles)) {
            return (
                <FormattedMessage
                    id='admin.system_users.list.actions.userGuest'
                    defaultMessage='Guest'
                />
            );
        }

        return (
            <FormattedMessage
                id='admin.system_users.list.actions.userMember'
                defaultMessage='Member'
            />
        );
    }

    const menuButtonId = `actionMenuButton-${tableId}-${rowIndex}`;
    const menuId = `actionMenu-${tableId}-${rowIndex}`;
    const menuItemIdPrefix = `actionMenuItem-${tableId}-${rowIndex}`;

    // Disable if SystemAdmin being edited by non SystemAdmin eg. userManager with EditOtherUsers permissions
    const isDisabled = !isSystemAdmin(currentUser.roles) && isSystemAdmin(user.roles);

    return (
        <Menu.Container
            menuButton={{
                id: menuButtonId,
                class: classNames('btn btn-quaternary btn-sm', {
                    disabled: isDisabled,
                }),
                disabled: isDisabled,
                children: (
                    <>
                        {getTranslatedUserRole(user.roles)}
                        {!isDisabled && (
                            <i
                                aria-hidden='true'
                                className='icon icon-chevron-down'
                            />
                        )}
                    </>
                ),
            }}
            menu={{
                id: menuId,
                'aria-label': formatMessage({
                    id: 'admin.system_users.list.actions.menu.dropdownAriaLabel',
                    defaultMessage: 'User actions menu',
                }),
            }}
        >
            {user.delete_at > 0 &&
            <Menu.Item
                id={`${menuItemIdPrefix}-active`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.activate'
                        defaultMessage='Activate'
                    />
                }
                onClick={async () => {
                    // TODO: disable if this is true
                    if (user.auth_service === Constants.LDAP_SERVICE) {
                        return;
                    }

                    const {error} = await dispatch(updateUserActive(user.id, true));
                    if (error) {
                        onError(error);
                    }

                    // TODO: add callback to update the user's active status
                }}
            />}

            {user.delete_at === 0 &&
            <Menu.Item
                id={`${menuItemIdPrefix}-deactivate`}
                isDestructive={true}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.deactivate'
                        defaultMessage='Deactivate'
                    />
                }
                onClick={() => {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.DEACTIVATE_MEMBER_MODAL,
                        dialogType: DeactivateMemberModal,

                        // TODO: add callback to update the user's active status
                        dialogProps: {user, onError},
                    }));
                }}
            />}

            {isSystemAdmin(currentUser.roles) &&
            <Menu.Item
                id={`${menuItemIdPrefix}-manageRoles`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.manageRoles'
                        defaultMessage='Mange roles'
                    />
                }
                onClick={() => {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.MANAGE_ROLES_MODAL,
                        dialogType: ManageRolesModal,

                        // TODO: add callback to update the user's role
                        dialogProps: {user},
                    }));
                }}
            />}

            <Menu.Item
                id={`${menuItemIdPrefix}-manageTeams`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.manageTeams'
                        defaultMessage='Manage teams'
                    />
                }
                onClick={() => {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.MANAGE_TEAMS_MODAL,
                        dialogType: ManageTeamsModal,
                        dialogProps: {user},
                    }));
                }}
            />

            {config.EnableUserAccessTokens === 'true' &&
            <Menu.Item
                id={`${menuItemIdPrefix}-manageTokens`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.manageTokens'
                        defaultMessage='Manage tokens'
                    />
                }
                onClick={() => {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.MANAGE_TOKENS_MODAL,
                        dialogType: ManageTokensModal,
                        dialogProps: {user},
                    }));
                }}
            />}

            {!user.auth_service &&
            <Menu.Item
                id={`${menuItemIdPrefix}-resetPassword`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.resetPassword'
                        defaultMessage='Reset password'
                    />
                }
                onClick={() => {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.RESET_PASSWORD_MODAL,
                        dialogType: ResetPasswordModal,
                        dialogProps: {user},
                    }));
                }}
            />}

            {user.mfa_active && config.EnableMultifactorAuthentication &&
            <Menu.Item
                id={`${menuItemIdPrefix}-removeMFA`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.removeMFA'
                        defaultMessage='Remove MFA'
                    />
                }
                onClick={() => {
                    adminResetMfa(user.id, null, onError).then(() => {
                        // TODO: update the user so this item doesn't appear
                    });
                }}
            />}

            {Boolean(user.auth_service) && config.ExperimentalEnableAuthenticationTransfer === 'true' &&
            <Menu.Item
                id={`${menuItemIdPrefix}-switchToEmailPassword`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.switchToEmailPassword'
                        defaultMessage='Switch to Email/Password'
                    />
                }
                onClick={() => {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.RESET_PASSWORD_MODAL,
                        dialogType: ResetPasswordModal,

                        // TODO: add callback to switch the user's auth service
                        dialogProps: {user},
                    }));
                }}
            />}

            {!user.auth_service &&
            <Menu.Item
                id={`${menuItemIdPrefix}-updateEmail`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.updateEmail'
                        defaultMessage='Update email'
                    />
                }
                onClick={() => {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.RESET_EMAIL_MODAL,
                        dialogType: ResetEmailModal,

                        // TODO: add callback to update the user's email address
                        dialogProps: {user},
                    }));
                }}
            />}

            {isGuest(user.roles) &&
            <Menu.Item
                id={`${menuItemIdPrefix}-promoteToMember`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.promoteToMember'
                        defaultMessage='Promote to member'
                    />
                }
                onClick={() => {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.PROMOTE_TO_MEMBER_MODAL,
                        dialogType: PromoteToMemberModal,

                        // TODO: add callback to update the user's role
                        dialogProps: {user, onError},
                    }));
                }}
            />}
            {!isGuest(user.roles) && user.id !== currentUser.id && isLicensed && config.EnableGuestAccounts &&
            <Menu.Item
                id={`${menuItemIdPrefix}-demoteToGuest`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.demoteToGuest'
                        defaultMessage='Demote to guest'
                    />
                }
                onClick={() => {
                    dispatch(openModal({
                        modalId: ModalIdentifiers.DEMOTE_TO_GUEST_MODAL,
                        dialogType: DemoteToGuestModal,

                        // TODO: add callback to update the user's role
                        dialogProps: {user, onError},
                    }));
                }}
            />}
            <SystemPermissionGate permissions={[Permissions.REVOKE_USER_ACCESS_TOKEN]}>
                {!user.delete_at &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-removeSessions`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.removeSessions'
                            defaultMessage='Remove sessions'
                        />
                    }
                    onClick={() => {
                        dispatch(openModal({
                            modalId: ModalIdentifiers.REVOKE_SESSIONS_MODAL,
                            dialogType: RevokeSessionsModal,
                            dialogProps: {user, currentUser, onError},
                        }));
                    }}
                />}
            </SystemPermissionGate>
            <SystemPermissionGate permissions={[Permissions.SYSCONSOLE_WRITE_USERMANAGEMENT_GROUPS]}>
                {user.auth_service === Constants.LDAP_SERVICE &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-resyncUserViaLdapGroups`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.resyncUserViaLdapGroups'
                            defaultMessage='Re-sync user via LDAP groups'
                        />
                    }
                    onClick={() => {
                        dispatch(openModal({
                            modalId: ModalIdentifiers.CREATE_GROUP_SYNCABLES_MEMBERSHIP_MODAL,
                            dialogType: CreateGroupSyncablesMembershipsModal,
                            dialogProps: {user, onError},
                        }));
                    }}
                />}
            </SystemPermissionGate>
        </Menu.Container>
    );
}
