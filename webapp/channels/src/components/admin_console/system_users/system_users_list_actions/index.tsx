// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';

import {updateUserActive} from 'mattermost-redux/actions/users';
import {Permissions} from 'mattermost-redux/constants';
import General from 'mattermost-redux/constants/general';
import {getConfig} from 'mattermost-redux/selectors/entities/admin';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles_helpers';
import {isSystemAdmin, isGuest} from 'mattermost-redux/utils/user_utils';

import {adminResetMfa} from 'actions/admin_actions';
import {openModal} from 'actions/views/modals';
import {getShowManageUserSettings} from 'selectors/admin_console';

import ManageRolesModal from 'components/admin_console/manage_roles_modal';
import ManageTeamsModal from 'components/admin_console/manage_teams_modal';
import ManageTokensModal from 'components/admin_console/manage_tokens_modal';
import ResetEmailModal from 'components/admin_console/reset_email_modal';
import ResetPasswordModal from 'components/admin_console/reset_password_modal';
import * as Menu from 'components/menu';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import UserSettingsModal from 'components/user_settings/modal';

import Constants, {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import ConfirmManageUserSettingsModal from './confirm_manage_user_settings_modal';
import ConfirmResetFailedAttemptsModal from './confirm_reset_failed_attempts_modal';
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
    updateUser: (user: Partial<UserProfile>) => void;
}

export function SystemUsersListAction({user, currentUser, tableId, rowIndex, onError, updateUser}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const config = useSelector(getConfig);
    const isLicensed = useSelector(getLicense)?.IsLicensed === 'true';
    const haveSysConsoleWriteUserManagementUsersPermissions = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.SYSCONSOLE_WRITE_USERMANAGEMENT_USERS}));
    const showManageUserSettings = useSelector(getShowManageUserSettings);

    function getTranslatedUserRole(userRoles: UserProfile['roles']) {
        if (user.delete_at > 0) {
            return (
                <FormattedMessage
                    id='admin.system_users.list.actions.deactivated'
                    defaultMessage='Deactivated'
                />
            );
        } else if (user.roles.length > 0 && isSystemAdmin(userRoles)) {
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

    const isCurrentUserSystemAdmin = useMemo(() => isSystemAdmin(currentUser.roles), [currentUser.roles]);

    // Disable if SystemAdmin being edited by non SystemAdmin eg. userManager with EditOtherUsers permissions
    const isNonSystemAdminEditingSystemAdmin = !isCurrentUserSystemAdmin && isSystemAdmin(user.roles);
    const disableEditingOtherUsers = isNonSystemAdminEditingSystemAdmin || !haveSysConsoleWriteUserManagementUsersPermissions;

    const handleManageRolesClick = useCallback(() => {
        function onRoleUpdateSuccess(roles: string) {
            updateUser({roles});
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.MANAGE_ROLES_MODAL,
            dialogType: ManageRolesModal,
            dialogProps: {
                user,
                onSuccess: onRoleUpdateSuccess,
            },
        }));
    }, [user, updateUser]);

    const handleManageTeamsClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.MANAGE_TEAMS_MODAL,
            dialogType: ManageTeamsModal,
            dialogProps: {
                user,
            },
        }));
    }, [user]);

    const handleManageUserSettingsClick = useCallback(() => {
        function onConfirmManageUserSettingsClick() {
            dispatch(openModal({
                modalId: ModalIdentifiers.USER_SETTINGS,
                dialogType: UserSettingsModal,
                dialogProps: {
                    adminMode: true,
                    isContentProductSettings: true,
                    userID: user.id,
                },
            }));
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.CONFIRM_MANAGE_USER_SETTINGS_MODAL,
            dialogType: ConfirmManageUserSettingsModal,
            dialogProps: {
                user,
                onConfirm: onConfirmManageUserSettingsClick,
            },
        }));
    }, [user]);

    const handleManageTokensClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.MANAGE_TOKENS_MODAL,
            dialogType: ManageTokensModal,
            dialogProps: {
                user,
            },
        }));
    }, [user.id]);

    const handleResetPasswordClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.RESET_PASSWORD_MODAL,
            dialogType: ResetPasswordModal,
            dialogProps: {
                user,
            },
        }));
    }, [user]);

    const handleRemoveMfaClick = useCallback(async () => {
        await adminResetMfa(user.id, null, onError).then(() => {
            updateUser({mfa_active: false});
        });

        try {
            await adminResetMfa(user.id, null, onError);
            updateUser({mfa_active: false});
        } catch (error) {
            onError(error);
        }
    }, [user.id, updateUser, onError]);

    const handleSwitchToEmailPasswordClick = useCallback(() => {
        function onSwitchToEmailPasswordSuccess() {
            updateUser({auth_service: undefined});
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.RESET_PASSWORD_MODAL,
            dialogType: ResetPasswordModal,
            dialogProps: {
                user,
                onSuccess: onSwitchToEmailPasswordSuccess,
            },
        }));
    }, [user, updateUser]);

    const handleUpdateEmailClick = useCallback(() => {
        function onUpdateEmailSuccess(email: string) {
            updateUser({email});
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.RESET_EMAIL_MODAL,
            dialogType: ResetEmailModal,
            dialogProps: {
                user,
                onSuccess: onUpdateEmailSuccess,
            },
        }));
    }, [user, updateUser]);

    const handlePromoteToMemberClick = useCallback(() => {
        function onPromoteToMemberSuccess() {
            updateUser({roles: user.roles.replace(General.SYSTEM_GUEST_ROLE, '')});
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.PROMOTE_TO_MEMBER_MODAL,
            dialogType: PromoteToMemberModal,
            dialogProps: {
                user,
                onError,
                onSuccess: onPromoteToMemberSuccess,
            },
        }));
    }, [user, updateUser, onError]);

    const handleDemoteToGuestClick = useCallback(() => {
        function onDemoteToGuestSuccess() {
            updateUser({roles: `${user.roles} ${General.SYSTEM_GUEST_ROLE}`});
        }

        dispatch(openModal({
            modalId: ModalIdentifiers.DEMOTE_TO_GUEST_MODAL,
            dialogType: DemoteToGuestModal,
            dialogProps: {
                user,
                onError,
                onSuccess: onDemoteToGuestSuccess,
            },
        }));
    }, [user, updateUser, onError]);

    const handleRemoveSessionsClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.REVOKE_SESSIONS_MODAL,
            dialogType: RevokeSessionsModal,
            dialogProps: {
                user,
                currentUser,
                onError,
            },
        }));
    }, [user, currentUser.id, onError]);

    const handleReSyncUserViaLdapGroupsClick = useCallback(() => {
        dispatch(openModal({
            modalId: ModalIdentifiers.CREATE_GROUP_SYNCABLES_MEMBERSHIP_MODAL,
            dialogType: CreateGroupSyncablesMembershipsModal,
            dialogProps: {
                user,
                onError,
            },
        }));
    }, [user, onError]);

    const handleActivateUserClick = useCallback(async () => {
        if (user.auth_service === Constants.LDAP_SERVICE) {
            return;
        }

        const {error} = await dispatch(updateUserActive(user.id, true));

        if (error) {
            onError(error);
        } else {
            updateUser({delete_at: 0});
        }
    }, [user.id, user.auth_service, updateUser, onError]);

    const handleDeactivateMemberClick = useCallback(() => {
        if (user.auth_service === Constants.LDAP_SERVICE) {
            return;
        }
        function onDeactivateMemberSuccess() {
            updateUser({delete_at: new Date().getMilliseconds()});
        }

        dispatch(
            openModal({
                modalId: ModalIdentifiers.DEACTIVATE_MEMBER_MODAL,
                dialogType: DeactivateMemberModal,
                dialogProps: {
                    user,
                    onError,
                    onSuccess: onDeactivateMemberSuccess,
                },
            }),
        );
    }, [user, updateUser, onError]);

    const handleResetAttemptsClick = useCallback(() => {
        function onResetAttemptsSuccess() {
            updateUser({failed_attempts: 0});
        }

        dispatch(
            openModal({
                modalId: ModalIdentifiers.CONFIRM_RESET_FAILED_ATTEMPTS_MODAL,
                dialogType: ConfirmResetFailedAttemptsModal,
                dialogProps: {
                    user,
                    onError,
                    onSuccess: onResetAttemptsSuccess,
                },
            }),
        );
    }, [user, updateUser, onError]);

    const disableActivationToggle = user.auth_service === Constants.LDAP_SERVICE;

    const getManagedByLDAPText = (managedByLDAP: boolean) => {
        return managedByLDAP ? {
            trailingElements: formatMessage({
                id: 'admin.system_users.list.actions.menu.managedByLdap',
                defaultMessage: 'Managed by LDAP',
            }),
        } : {};
    };

    const showResetFailedAttempts = useCallback(() => {
        if (user.failed_attempts === undefined) {
            return false;
        }

        if (user.auth_service !== Constants.LDAP_SERVICE && user.auth_service !== '') {
            return false;
        }

        return true;
    }, [user]);

    return (
        <Menu.Container
            menuButton={{
                id: menuButtonId,
                class: classNames('btn btn-quaternary btn-sm', {
                    disabled: disableEditingOtherUsers,
                }),
                disabled: disableEditingOtherUsers,
                children: (
                    <>
                        {getTranslatedUserRole(user.roles)}
                        {!disableEditingOtherUsers && (
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
            {user.delete_at > 0 && (
                <Menu.Item
                    id={`${menuItemIdPrefix}-active`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.activate'
                            defaultMessage='Activate'
                        />
                    }
                    disabled={disableActivationToggle}
                    {...getManagedByLDAPText(disableActivationToggle)}
                    onClick={handleActivateUserClick}
                />
            )}
            {isCurrentUserSystemAdmin &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-manageRoles`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.manageRoles'
                            defaultMessage='Manage roles'
                        />
                    }
                    onClick={handleManageRolesClick}
                />
            }
            <Menu.Item
                id={`${menuItemIdPrefix}-manageTeams`}
                labels={
                    <FormattedMessage
                        id='admin.system_users.list.actions.menu.manageTeams'
                        defaultMessage='Manage teams'
                    />
                }
                onClick={handleManageTeamsClick}
            />
            {showManageUserSettings &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-manageTeams`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.manageSettings'
                            defaultMessage='Manage user settings'
                        />
                    }
                    onClick={handleManageUserSettingsClick}
                />
            }
            {config.ServiceSettings?.EnableUserAccessTokens &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-manageTokens`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.manageTokens'
                            defaultMessage='Manage tokens'
                        />
                    }
                    onClick={handleManageTokensClick}
                />
            }
            {!user.auth_service &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-resetPassword`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.resetPassword'
                            defaultMessage='Reset password'
                        />
                    }
                    onClick={handleResetPasswordClick}
                />
            }
            {showResetFailedAttempts() && (
                <Menu.Item
                    id={`${menuItemIdPrefix}-resetAttempts`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.resetAttempts'
                            defaultMessage='Reset login attempts'
                        />
                    }
                    onClick={handleResetAttemptsClick}
                />
            )}
            {user.mfa_active && config.ServiceSettings?.EnableMultifactorAuthentication &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-removeMFA`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.removeMFA'
                            defaultMessage='Remove MFA'
                        />
                    }
                    onClick={handleRemoveMfaClick}
                />
            }
            {Boolean(user.auth_service) && config.ServiceSettings?.ExperimentalEnableAuthenticationTransfer &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-switchToEmailPassword`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.switchToEmailPassword'
                            defaultMessage='Switch to Email/Password'
                        />
                    }
                    onClick={handleSwitchToEmailPasswordClick}
                />
            }
            {!user.auth_service &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-updateEmail`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.updateEmail'
                            defaultMessage='Update email'
                        />
                    }
                    onClick={handleUpdateEmailClick}
                />
            }
            {isGuest(user.roles) &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-promoteToMember`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.promoteToMember'
                            defaultMessage='Promote to member'
                        />
                    }
                    onClick={handlePromoteToMemberClick}
                />
            }
            {!isGuest(user.roles) && user.id !== currentUser.id && isLicensed && config.GuestAccountsSettings?.Enable &&
                <Menu.Item
                    id={`${menuItemIdPrefix}-demoteToGuest`}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.demoteToGuest'
                            defaultMessage='Demote to guest'
                        />
                    }
                    onClick={handleDemoteToGuestClick}
                />
            }
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
                        onClick={handleRemoveSessionsClick}
                    />
                }
            </SystemPermissionGate>
            <SystemPermissionGate permissions={[Permissions.SYSCONSOLE_WRITE_USERMANAGEMENT_GROUPS]}>
                {(user.auth_service === Constants.LDAP_SERVICE || (user.auth_service === Constants.SAML_SERVICE && config.SamlSettings?.EnableSyncWithLdap)) &&
                    <Menu.Item
                        id={`${menuItemIdPrefix}-resyncUserViaLdapGroups`}
                        labels={
                            <FormattedMessage
                                id='admin.system_users.list.actions.menu.resyncUserViaLdapGroups'
                                defaultMessage='Re-sync user via LDAP groups'
                            />
                        }
                        onClick={handleReSyncUserViaLdapGroupsClick}
                    />
                }
            </SystemPermissionGate>
            {user.delete_at === 0 && (
                <Menu.Item
                    id={`${menuItemIdPrefix}-deactivate`}
                    isDestructive={true}
                    labels={
                        <FormattedMessage
                            id='admin.system_users.list.actions.menu.deactivate'
                            defaultMessage='Deactivate'
                        />
                    }
                    onClick={handleDeactivateMemberClick}
                    disabled={disableActivationToggle}
                    {...getManagedByLDAPText(disableActivationToggle)}
                />
            )}
        </Menu.Container>
    );
}
