// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {Bot} from '@mattermost/types/bots';
import type {AdminConfig} from '@mattermost/types/config';
import type {ServerError} from '@mattermost/types/errors';
import type {UserProfile} from '@mattermost/types/users';
import type {DeepPartial} from '@mattermost/types/utilities';

import {Permissions} from 'mattermost-redux/constants';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import {adminResetMfa} from 'actions/admin_actions.jsx';
import {emitUserLoggedOutEvent} from 'actions/global_actions';

import ConfirmModal from 'components/confirm_modal';
import ExternalLink from 'components/external_link';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';
import SystemPermissionGate from 'components/permissions_gates/system_permission_gate';
import Menu from 'components/widgets/menu/menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';

import {Constants} from 'utils/constants';
import {t} from 'utils/i18n';
import {getSiteURL} from 'utils/url';
import * as Utils from 'utils/utils';

const ROWS_FROM_BOTTOM_TO_OPEN_UP = 3;
const TOTAL_USERS_TO_OPEN_UP = 5;

export type Props = {
    user: UserProfile;
    currentUser: UserProfile;
    mfaEnabled: boolean;
    enableUserAccessTokens: boolean;
    experimentalEnableAuthenticationTransfer: boolean;
    index: number;
    totalUsers: number;
    config: DeepPartial<AdminConfig>;
    bots: Record<string, Bot>;
    isLicensed: boolean;
    isDisabled: boolean;
    actions: {
        updateUserActive: (id: string, active: boolean) => Promise<{error: ServerError}>;
        revokeAllSessionsForUser: (id: string) => Promise<{error: ServerError; data: any}>;
        promoteGuestToUser: (id: string) => Promise<{error: ServerError}>;
        demoteUserToGuest: (id: string) => Promise<{error: ServerError}>;
        loadBots: (page?: number, size?: number) => Promise<unknown>;
        createGroupTeamsAndChannels: (userId: string) => Promise<{error: ServerError}>;
    };
    doPasswordReset: (user: UserProfile) => void;
    doEmailReset: (user: UserProfile) => void;
    doManageTeams: (user: UserProfile) => void;
    doManageRoles: (user: UserProfile) => void;
    doManageTokens: (user: UserProfile) => void;
    onError: (error: ServerError | {id: string}) => void;
}

type State = {
    showDeactivateMemberModal: boolean;
    showRevokeSessionsModal: boolean;
    showPromoteToUserModal: boolean;
    showDemoteToGuestModal: boolean;
    showCreateGroupMembershipsModal: boolean;
    user: UserProfile | null;
    role: string | null;
}

export default class SystemUsersDropdown extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            showDeactivateMemberModal: false,
            showRevokeSessionsModal: false,
            showPromoteToUserModal: false,
            showDemoteToGuestModal: false,
            showCreateGroupMembershipsModal: false,
            user: null,
            role: null,
        };
    }

    handleMakeActive = (e: {preventDefault: () => void}) => {
        e.preventDefault();
        this.props.actions.updateUserActive(this.props.user.id, true).
            then(this.onUpdateActiveResult);
    };

    handleManageTeams = (e: {preventDefault: () => void}) => {
        e.preventDefault();

        this.props.doManageTeams(this.props.user);
    };

    handleManageRoles = (e: {preventDefault: () => void}) => {
        e.preventDefault();

        this.props.doManageRoles(this.props.user);
    };

    handleManageTokens = (e: {preventDefault: () => void}) => {
        e.preventDefault();

        this.props.doManageTokens(this.props.user);
    };

    handleResetPassword = (e: {preventDefault: () => void}) => {
        e.preventDefault();
        this.props.doPasswordReset(this.props.user);
    };

    handleResetEmail = (e: {preventDefault: () => void}) => {
        e.preventDefault();
        this.props.doEmailReset(this.props.user);
    };

    handleResetMfa = (e: {preventDefault: () => void}) => {
        e.preventDefault();
        adminResetMfa(this.props.user.id, null, this.props.onError);
    };

    handleShowDeactivateMemberModal = async (e: {preventDefault: () => void}) => {
        e.preventDefault();
        if (this.shouldDisableBotsWhenOwnerIsDeactivated()) {
            await this.props.actions.loadBots(
                Constants.Integrations.START_PAGE_NUM,
                parseInt(Constants.Integrations.PAGE_SIZE, 10),
            );
        }
        this.setState({showDeactivateMemberModal: true});
    };

    handleDeactivateMember = () => {
        this.props.actions.updateUserActive(this.props.user.id, false).
            then(this.onUpdateActiveResult);
        this.setState({showDeactivateMemberModal: false});
    };

    onUpdateActiveResult = ({error}: {error: ServerError}) => {
        if (error) {
            this.props.onError({id: error.server_error_id, ...error});
        }
    };

    handleDeactivateCancel = () => {
        this.setState({showDeactivateMemberModal: false});
    };

    renderDeactivateMemberModal = () => {
        const user = this.props.user;
        const title = (
            <FormattedMessage
                id='deactivate_member_modal.title'
                defaultMessage='Deactivate {username}'
                values={{
                    username: this.props.user.username,
                }}
            />
        );

        const defaultMessage = (
            <FormattedMarkdownMessage
                id='deactivate_member_modal.desc'
                defaultMessage='This action deactivates {username}. They will be logged out and not have access to any teams or channels on this system.\n'
                values={{
                    username: user.username,
                }}
            />);

        let warning;
        if (user.auth_service !== '' && user.auth_service !== Constants.EMAIL_SERVICE) {
            warning = (
                <strong>
                    <br/>
                    <br/>
                    <FormattedMessage
                        id='deactivate_member_modal.sso_warning'
                        defaultMessage='You must also deactivate this user in the SSO provider or they will be reactivated on next login or sync.'
                    />
                </strong>
            );
        }

        const confirmationMessage = (
            <FormattedMarkdownMessage
                id='deactivate_member_modal.desc.confirm'
                defaultMessage='Are you sure you want to deactivate {username}?'
                values={{
                    username: user.username,
                }}
            />);
        let messageForUsersWithBotAccounts;
        if (this.shouldDisableBotsWhenOwnerIsDeactivated()) {
            for (const bot of Object.values(this.props.bots)) {
                if ((bot.owner_id === user.id) && this.state.showDeactivateMemberModal && (bot.delete_at === 0)) {
                    messageForUsersWithBotAccounts = (
                        <>
                            <ul>
                                <li>
                                    <FormattedMessage
                                        id='deactivate_member_modal.desc.for_users_with_bot_accounts1'
                                        defaultMessage='This action deactivates {username}'
                                        values={{
                                            username: user.username,
                                        }}
                                    />
                                </li>
                                <li>
                                    <FormattedMessage
                                        id='deactivate_member_modal.desc.for_users_with_bot_accounts2'
                                        defaultMessage='They will be logged out and not have access to any teams or channels on this system.'
                                    />
                                </li>
                                <li>
                                    <FormattedMessage
                                        id='deactivate_member_modal.desc.for_users_with_bot_accounts3'
                                        defaultMessage='Bot accounts they manage will be disabled along with their integrations. To enable them again, go to <linkBots>Integrations > Bot Accounts</linkBots>. <linkDocumentation>Learn more about bot accounts</linkDocumentation>.'
                                        values={{
                                            siteURL: getSiteURL(),
                                            linkBots: (msg: React.ReactNode) => (
                                                <a
                                                    href={`${getSiteURL()}/_redirect/integrations/bots`}
                                                >
                                                    {msg}
                                                </a>
                                            ),
                                            linkDocumentation: (msg: React.ReactNode) => (
                                                <ExternalLink
                                                    href='https://mattermost.com/pl/default-bot-accounts'
                                                    location='system_users_dropdown'
                                                >
                                                    {msg}
                                                </ExternalLink>
                                            ),
                                        }}
                                    />
                                </li>
                            </ul>
                            <p/>
                            <p/>
                        </>
                    );
                    break;
                }
            }
        }
        const message = (
            <div>
                {messageForUsersWithBotAccounts || defaultMessage}
                {confirmationMessage}
                {warning}
            </div>
        );

        const confirmButtonClass = 'btn btn-danger';
        const deactivateMemberButton = (
            <FormattedMessage
                id='deactivate_member_modal.deactivate'
                defaultMessage='Deactivate'
            />
        );

        return (
            <ConfirmModal
                show={this.state.showDeactivateMemberModal}
                title={title}
                message={message}
                confirmButtonClass={confirmButtonClass}
                confirmButtonText={deactivateMemberButton}
                onConfirm={this.handleDeactivateMember}
                onCancel={this.handleDeactivateCancel}
            />
        );
    };

    shouldDisableBotsWhenOwnerIsDeactivated() {
        return this.props.config &&
            this.props.config.ServiceSettings &&
            this.props.config.ServiceSettings.DisableBotsWhenOwnerIsDeactivated;
    }

    handleShowRevokeSessionsModal = (e: {preventDefault: () => void}) => {
        e.preventDefault();
        this.setState({showRevokeSessionsModal: true});
    };

    handleShowCreateGroupSyncableMembershipsModal = (e: {preventDefault: () => void}) => {
        e.preventDefault();
        this.setState({showCreateGroupMembershipsModal: true});
    };

    handleCreateGroupSyncableMemberships = async () => {
        const {error} = await this.props.actions.createGroupTeamsAndChannels(this.props.user.id);
        if (error) {
            this.props.onError(error);
        }

        this.setState({showCreateGroupMembershipsModal: false});
    };

    handleCreateGroupSyncableMembershipsCancel = () => {
        this.setState({showCreateGroupMembershipsModal: false});
    };

    handleRevokeSessions = async () => {
        const me = this.props.currentUser;

        const {data, error} = await this.props.actions.revokeAllSessionsForUser(this.props.user.id);
        if (data && this.props.user.id === me.id) {
            emitUserLoggedOutEvent();
        } else if (error) {
            this.props.onError(error);
        }

        this.setState({showRevokeSessionsModal: false});
    };

    handleRevokeSessionsCancel = () => {
        this.setState({showRevokeSessionsModal: false});
    };

    handlePromoteToUser = () => {
        this.setState({showPromoteToUserModal: true});
    };

    handlePromoteToUserConfirm = async () => {
        const {error} = await this.props.actions.promoteGuestToUser(this.props.user.id);
        if (error) {
            this.props.onError(error);
        }

        this.setState({showPromoteToUserModal: false});
    };

    handlePromoteToUserCancel = () => {
        this.setState({showPromoteToUserModal: false});
    };

    handleDemoteToGuest = () => {
        this.setState({showDemoteToGuestModal: true});
    };

    handleDemoteToGuestConfirm = async () => {
        const {error} = await this.props.actions.demoteUserToGuest(this.props.user.id);
        if (error) {
            this.props.onError(error);
        }
        this.setState({showDemoteToGuestModal: false});
    };

    handleDemoteToGuestCancel = () => {
        this.setState({showDemoteToGuestModal: false});
    };

    renderPromoteToUserModal = () => {
        const title = (
            <FormattedMessage
                id='promote_to_user_modal.title'
                defaultMessage='Promote guest {username} to member'
                values={{
                    username: this.props.user.username,
                }}
            />
        );

        const message = (
            <FormattedMessage
                id='promote_to_user_modal.desc'
                defaultMessage='This action promotes the guest {username} to a member. It will allow the user to join public channels and interact with users outside of the channels they are currently members of. Are you sure you want to promote guest {username} to member?'
                values={{
                    username: this.props.user.username,
                }}
            />
        );

        const promoteUserButton = (
            <FormattedMessage
                id='promote_to_user_modal.promote'
                defaultMessage='Promote'
            />
        );

        return (
            <ConfirmModal
                show={this.state.showPromoteToUserModal}
                title={title}
                message={message}
                confirmButtonClass='btn btn-danger'
                confirmButtonText={promoteUserButton}
                onConfirm={this.handlePromoteToUserConfirm}
                onCancel={this.handlePromoteToUserCancel}
            />
        );
    };

    renderDemoteToGuestModal = () => {
        const title = (
            <FormattedMessage
                id='demote_to_user_modal.title'
                defaultMessage='Demote User {username} to Guest'
                values={{
                    username: this.props.user.username,
                }}
            />
        );

        const message = (
            <FormattedMessage
                id='demote_to_user_modal.desc'
                defaultMessage={'This action demotes the user {username} to a guest. It will restrict the user\'s ability to join public channels and interact with users outside of the channels they are currently members of. Are you sure you want to demote user {username} to guest?'}
                values={{
                    username: this.props.user.username,
                }}
            />
        );

        const demoteGuestButton = (
            <FormattedMessage
                id='demote_to_user_modal.demote'
                defaultMessage='Demote'
            />
        );

        return (
            <ConfirmModal
                show={this.state.showDemoteToGuestModal}
                title={title}
                message={message}
                confirmButtonClass='btn btn-danger'
                confirmButtonText={demoteGuestButton}
                onConfirm={this.handleDemoteToGuestConfirm}
                onCancel={this.handleDemoteToGuestCancel}
            />
        );
    };

    renderRevokeSessionsModal = () => {
        const title = (
            <FormattedMessage
                id='revoke_user_sessions_modal.title'
                defaultMessage='Revoke Sessions for {username}'
                values={{
                    username: this.props.user.username,
                }}
            />
        );

        const message = (
            <FormattedMessage
                id='revoke_user_sessions_modal.desc'
                defaultMessage='This action revokes all sessions for {username}. They will be logged out from all devices. Are you sure you want to revoke all sessions for {username}?'
                values={{
                    username: this.props.user.username,
                }}
            />
        );

        const revokeUserButtonButton = (
            <FormattedMessage
                id='revoke_user_sessions_modal.revoke'
                defaultMessage='Revoke'
            />
        );

        return (
            <ConfirmModal
                show={this.state.showRevokeSessionsModal}
                title={title}
                message={message}
                confirmButtonClass='btn btn-danger'
                confirmButtonText={revokeUserButtonButton}
                onConfirm={this.handleRevokeSessions}
                onCancel={this.handleRevokeSessionsCancel}
            />
        );
    };

    renderCreateGroupSyncablesMembershipsModal = () => {
        const title = (
            <FormattedMessage
                id='create_group_memberships_modal.title'
                defaultMessage='Re-add {username} to teams and channels'
                values={{
                    username: this.props.user.username,
                }}
            />
        );

        const message = (
            <FormattedMessage
                id='create_group_memberships_modal.desc'
                defaultMessage="You're about to add or re-add {username} to teams and channels based on their LDAP group membership. You can revert this change at any time."
                values={{
                    username: this.props.user.username,
                }}
            />
        );

        const createGroupMembershipsButton = (
            <FormattedMessage
                id='create_group_memberships_modal.create'
                defaultMessage='Yes'
            />
        );

        const cancelGroupMembershipsButton = (
            <FormattedMessage
                id='create_group_memberships_modal.cancel'
                defaultMessage='No'
            />
        );

        return (
            <ConfirmModal
                show={this.state.showCreateGroupMembershipsModal}
                title={title}
                message={message}
                confirmButtonClass='btn btn-danger'
                cancelButtonText={cancelGroupMembershipsButton}
                confirmButtonText={createGroupMembershipsButton}
                onConfirm={this.handleCreateGroupSyncableMemberships}
                onCancel={this.handleCreateGroupSyncableMembershipsCancel}
            />
        );
    };

    renderAccessToken = () => {
        const userAccessTokensEnabled = this.props.enableUserAccessTokens;
        if (!userAccessTokensEnabled) {
            return null;
        }

        const user = this.props.user;
        const hasPostAllRole = UserUtils.hasPostAllRole(user.roles);
        const hasPostAllPublicRole = UserUtils.hasPostAllPublicRole(user.roles);
        const hasUserAccessTokenRole = UserUtils.hasUserAccessTokenRole(user.roles);
        const isSystemAdmin = UserUtils.isSystemAdmin(user.roles);

        let messageId = '';
        if (hasUserAccessTokenRole || isSystemAdmin) {
            if (hasPostAllRole) {
                messageId = t('admin.user_item.userAccessTokenPostAll');
            } else if (hasPostAllPublicRole) {
                messageId = t('admin.user_item.userAccessTokenPostAllPublic');
            } else {
                messageId = t('admin.user_item.userAccessTokenYes');
            }
        }

        if (!messageId) {
            return null;
        }

        return (
            <div className='light mt-1'>
                <FormattedMessage
                    key='admin.user_item.userAccessToken'
                    id={messageId}
                />
            </div>
        );
    };

    render() {
        const {currentUser, user, isLicensed, config} = this.props;

        let isDisabled = this.props.isDisabled;
        if (!isDisabled) {
            // if not already disabled,
            // disable if SystemAdmin being edited by non SystemAdmin
            // ie, userManager with EditOtherUsers permissions
            isDisabled = UserUtils.isSystemAdmin(user.roles) && !UserUtils.isSystemAdmin(currentUser.roles);
        }

        const isGuest = UserUtils.isGuest(user.roles);
        if (!user) {
            return <div/>;
        }

        let currentRoles = (
            <FormattedMessage
                id='admin.user_item.member'
                defaultMessage='Member'
            />
        );

        if (isGuest) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.guest'
                    defaultMessage='Guest'
                />
            );
        }

        if (user.roles.length > 0 && UserUtils.isSystemAdmin(user.roles)) {
            currentRoles = (
                <FormattedMessage
                    id='team_members_dropdown.systemAdmin'
                    defaultMessage='System Admin'
                />
            );
        }

        let showMakeActive = false;
        let showMakeNotActive = !UserUtils.isSystemAdmin(user.roles);
        let showManageTeams = true;
        let showRevokeSessions = true;
        const showMfaReset = this.props.mfaEnabled && Boolean(user.mfa_active);
        const showManageRoles = UserUtils.isSystemAdmin(currentUser.roles);

        if (user.delete_at > 0) {
            currentRoles = (
                <FormattedMessage
                    id='admin.user_item.inactive'
                    defaultMessage='Inactive'
                />
            );
            showMakeActive = true;
            showMakeNotActive = false;
            showManageTeams = false;
            showRevokeSessions = false;
        }

        let disableActivationToggle = false;
        if (user.auth_service === Constants.LDAP_SERVICE) {
            disableActivationToggle = true;
        }

        const deactivateMemberModal = this.renderDeactivateMemberModal();
        const revokeSessionsModal = this.renderRevokeSessionsModal();
        const promoteToUserModal = this.renderPromoteToUserModal();
        const demoteToGuestModal = this.renderDemoteToGuestModal();
        const createGroupSyncablesMembershipsModal = this.renderCreateGroupSyncablesMembershipsModal();

        const {index, totalUsers} = this.props;
        return (
            <React.Fragment>
                {deactivateMemberModal}
                {revokeSessionsModal}
                {promoteToUserModal}
                {demoteToGuestModal}
                {createGroupSyncablesMembershipsModal}
                <MenuWrapper
                    isDisabled={isDisabled}
                >
                    <div className='text-right'>
                        <a>
                            <span>{currentRoles} </span>
                            {!isDisabled &&
                                <span className='caret'/>
                            }
                        </a>
                        {this.renderAccessToken()}
                    </div>
                    <Menu
                        openLeft={true}
                        openUp={totalUsers > TOTAL_USERS_TO_OPEN_UP && totalUsers - index <= ROWS_FROM_BOTTOM_TO_OPEN_UP}
                        ariaLabel={Utils.localizeMessage('admin.user_item.menuAriaLabel', 'User Actions Menu')}
                    >
                        <Menu.ItemAction
                            show={showMakeActive}
                            onClick={this.handleMakeActive}
                            text={Utils.localizeMessage('admin.user_item.makeActive', 'Activate')}
                            disabled={disableActivationToggle}
                        />
                        <Menu.ItemAction
                            show={showMakeNotActive}
                            onClick={this.handleShowDeactivateMemberModal}
                            text={Utils.localizeMessage('admin.user_item.makeInactive', 'Deactivate')}
                            disabled={disableActivationToggle}
                        />
                        <Menu.ItemAction
                            show={showManageRoles}
                            onClick={this.handleManageRoles}
                            text={Utils.localizeMessage('admin.user_item.manageRoles', 'Manage Roles')}
                        />
                        <Menu.ItemAction
                            show={showManageTeams}
                            onClick={this.handleManageTeams}
                            text={Utils.localizeMessage('admin.user_item.manageTeams', 'Manage Teams')}
                        />
                        <Menu.ItemAction
                            show={this.props.enableUserAccessTokens}
                            onClick={this.handleManageTokens}
                            text={Utils.localizeMessage('admin.user_item.manageTokens', 'Manage Tokens')}
                        />
                        <Menu.ItemAction
                            show={showMfaReset}
                            onClick={this.handleResetMfa}
                            text={Utils.localizeMessage('admin.user_item.resetMfa', 'Remove MFA')}
                        />
                        <Menu.ItemAction
                            show={Boolean(user.auth_service) && this.props.experimentalEnableAuthenticationTransfer}
                            onClick={this.handleResetPassword}
                            text={Utils.localizeMessage('admin.user_item.switchToEmail', 'Switch to Email/Password')}
                        />
                        <Menu.ItemAction
                            show={!user.auth_service}
                            onClick={this.handleResetPassword}
                            text={Utils.localizeMessage('admin.user_item.resetPwd', 'Reset Password')}
                        />
                        <Menu.ItemAction
                            show={!user.auth_service}
                            onClick={this.handleResetEmail}
                            text={Utils.localizeMessage('admin.user_item.resetEmail', 'Update Email')}
                        />
                        <Menu.ItemAction
                            show={isGuest}
                            onClick={this.handlePromoteToUser}
                            text={Utils.localizeMessage('admin.user_item.promoteToMember', 'Promote to Member')}
                        />
                        <Menu.ItemAction
                            show={!isGuest && user.id !== currentUser.id && isLicensed && config.GuestAccountsSettings?.Enable}
                            onClick={this.handleDemoteToGuest}
                            text={Utils.localizeMessage('admin.user_item.demoteToGuest', 'Demote to Guest')}
                        />
                        <SystemPermissionGate permissions={[Permissions.REVOKE_USER_ACCESS_TOKEN]}>
                            <Menu.ItemAction
                                show={showRevokeSessions}
                                onClick={this.handleShowRevokeSessionsModal}
                                text={Utils.localizeMessage('admin.user_item.revokeSessions', 'Revoke Sessions')}
                            />
                        </SystemPermissionGate>
                        <SystemPermissionGate permissions={[Permissions.SYSCONSOLE_WRITE_USERMANAGEMENT_GROUPS]}>
                            <Menu.ItemAction
                                show={user.auth_service === Constants.LDAP_SERVICE}
                                onClick={this.handleShowCreateGroupSyncableMembershipsModal}
                                text={Utils.localizeMessage('admin.user_item.createGroupTeamChannelMemberships', 'Re-sync user via LDAP groups')}
                            />
                        </SystemPermissionGate>
                    </Menu>
                </MenuWrapper>
            </React.Fragment>
        );
    }
}
