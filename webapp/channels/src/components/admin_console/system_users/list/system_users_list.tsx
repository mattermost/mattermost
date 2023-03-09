// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {UserProfile} from '@mattermost/types/users';
import {getUserAccessTokensForUser} from 'mattermost-redux/actions/users';

import {Team} from '@mattermost/types/teams';

import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';
import ManageRolesModal from 'components/admin_console/manage_roles_modal';
import ManageTeamsModal from 'components/admin_console/manage_teams_modal';
import ManageTokensModal from 'components/admin_console/manage_tokens_modal';
import ResetPasswordModal from 'components/admin_console/reset_password_modal';
import ResetEmailModal from 'components/admin_console/reset_email_modal';
import SearchableUserList from 'components/searchable_user_list/searchable_user_list';
import UserListRowWithError from 'components/user_list_row_with_error';
import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import SystemUsersDropdown from '../system_users_dropdown';

type Props = {
    users: UserProfile[];
    teams?: Team[];
    usersPerPage: number;
    total: number;
    nextPage: (page: number) => void;
    search: (term: string) => void;
    focusOnMount?: boolean;
    renderFilterRow: (doSearch: ((event: React.FormEvent<HTMLInputElement>) => void) | undefined) => JSX.Element;

    teamId: string;
    filter: string;
    term: string;
    onTermChange: (term: string) => void;
    isDisabled?: boolean;

    /**
     * Whether MFA is licensed and enabled.
     */
    mfaEnabled: boolean;

    /**
     * Whether or not user access tokens are enabled.
     */
    enableUserAccessTokens: boolean;

    /**
     * Whether or not the experimental authentication transfer is enabled.
     */
    experimentalEnableAuthenticationTransfer: boolean;

    actions: {
        getUser: (id: string) => UserProfile;
    };
};

type State = {
    page: number;
    filter: string;
    teamId: string;
    showManageTeamsModal: boolean;
    showManageRolesModal: boolean;
    showManageTokensModal: boolean;
    showPasswordModal: boolean;
    showEmailModal: boolean;
    user?: UserProfile;
};

export default class SystemUsersList extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            page: 0,

            filter: props.filter,
            teamId: props.teamId,
            showManageTeamsModal: false,
            showManageRolesModal: false,
            showManageTokensModal: false,
            showPasswordModal: false,
            showEmailModal: false,
            user: undefined,
        };
    }

    static getDerivedStateFromProps(nextProps: Props, prevState: State): { page: number; teamId: string; filter: string } | null {
        if (prevState.teamId !== nextProps.teamId || prevState.filter !== nextProps.filter) {
            return {
                page: 0,
                teamId: nextProps.teamId,
                filter: nextProps.filter,
            };
        }
        return null;
    }

    nextPage = () => {
        this.setState({page: this.state.page + 1});

        this.props.nextPage(this.state.page + 1);
    }

    previousPage = () => {
        this.setState({page: this.state.page - 1});
    }

    search = (term: string) => {
        this.props.search(term);

        if (term !== '') {
            this.setState({page: 0});
        }
    }

    doManageTeams = (user: UserProfile) => {
        this.setState({
            showManageTeamsModal: true,
            user,
        });
    }

    doManageRoles = (user: UserProfile) => {
        this.setState({
            showManageRolesModal: true,
            user,
        });
    }

    doManageTokens = (user: UserProfile) => {
        this.setState({
            showManageTokensModal: true,
            user,
        });
    }

    doManageTeamsDismiss = () => {
        this.setState({
            showManageTeamsModal: false,
            user: undefined,
        });
    }

    doManageRolesDismiss = () => {
        this.setState({
            showManageRolesModal: false,
            user: undefined,
        });
    }

    doManageTokensDismiss = () => {
        this.setState({
            showManageTokensModal: false,
            user: undefined,
        });
    }

    doPasswordReset = (user: UserProfile) => {
        this.setState({
            showPasswordModal: true,
            user,
        });
    }

    doPasswordResetDismiss = () => {
        this.setState({
            showPasswordModal: false,
            user: undefined,
        });
    }

    doPasswordResetSubmit = (user?: UserProfile) => {
        if (user) {
            this.props.actions.getUser(user.id);
        }

        this.setState({
            showPasswordModal: false,
            user: undefined,
        });
    }

    doEmailReset = (user: UserProfile) => {
        this.setState({
            showEmailModal: true,
            user,
        });
    }

    doEmailResetDismiss = () => {
        this.setState({
            showEmailModal: false,
            user: undefined,
        });
    }

    doEmailResetSubmit = (user?: UserProfile) => {
        if (user) {
            this.props.actions.getUser(user.id);
        }

        this.setState({
            showEmailModal: false,
            user: undefined,
        });
    }

    getInfoForUser(user: UserProfile) {
        const info = [];

        if (user.auth_service) {
            let service;
            if (user.auth_service === Constants.LDAP_SERVICE || user.auth_service === Constants.SAML_SERVICE) {
                service = user.auth_service.toUpperCase();
            } else {
                service = Utils.toTitleCase(user.auth_service);
            }

            info.push(
                <FormattedMarkdownMessage
                    key='admin.user_item.authServiceNotEmail'
                    id='admin.user_item.authServiceNotEmail'
                    defaultMessage='**Sign-in Method:** {service}'
                    values={{
                        service,
                    }}
                />,
            );
        } else {
            info.push(
                <FormattedMarkdownMessage
                    key='admin.user_item.authServiceEmail'
                    id='admin.user_item.authServiceEmail'
                    defaultMessage='**Sign-in Method:** Email'
                />,
            );
        }

        info.push(', ');
        const userID = user.id;
        info.push(
            <FormattedMarkdownMessage
                key='admin.user_item.user_id'
                id='admin.user_item.user_id'
                defaultMessage='**User ID:** {userID}'
                values={{
                    userID,
                }}
            />,
        );

        if (this.props.mfaEnabled) {
            info.push(', ');

            if (user.mfa_active) {
                info.push(
                    <FormattedMarkdownMessage
                        key='admin.user_item.mfaYes'
                        id='admin.user_item.mfaYes'
                        defaultMessage='**MFA**: Yes'
                    />,
                );
            } else {
                info.push(
                    <FormattedMarkdownMessage
                        key='admin.user_item.mfaNo'
                        id='admin.user_item.mfaNo'
                        defaultMessage='**MFA**: No'
                    />,
                );
            }
        }

        return info;
    }

    renderCount(count: number, total: number, startCount: number, endCount: number, isSearch: boolean) {
        if (total) {
            if (isSearch) {
                return (
                    <FormattedMessage
                        id='system_users_list.countSearch'
                        defaultMessage='{count, number} {count, plural, one {user} other {users}} of {total, number} total'
                        values={{
                            count,
                            total,
                        }}
                    />
                );
            } else if (startCount !== 0 || endCount !== total) {
                return (
                    <FormattedMessage
                        id='system_users_list.countPage'
                        defaultMessage='{startCount, number} - {endCount, number} {count, plural, one {user} other {users}} of {total, number} total'
                        values={{
                            count,
                            startCount: startCount + 1,
                            endCount,
                            total,
                        }}
                    />
                );
            }

            return (
                <FormattedMessage
                    id='system_users_list.count'
                    defaultMessage='{count, number} {count, plural, one {user} other {users}}'
                    values={{
                        count,
                    }}
                />
            );
        }

        return null;
    }

    render() {
        const extraInfo: {[key: string]: Array<string | JSX.Element>} = {};
        if (this.props.users) {
            for (const user of this.props.users) {
                extraInfo[user.id] = this.getInfoForUser(user);
            }
        }

        return (
            <div>
                <SearchableUserList
                    {...this.props}
                    renderCount={this.renderCount}
                    extraInfo={extraInfo}
                    actions={[SystemUsersDropdown]}
                    actionProps={{
                        mfaEnabled: this.props.mfaEnabled,
                        enableUserAccessTokens: this.props.enableUserAccessTokens,
                        experimentalEnableAuthenticationTransfer: this.props.experimentalEnableAuthenticationTransfer,
                        doPasswordReset: this.doPasswordReset,
                        doEmailReset: this.doEmailReset,
                        doManageTeams: this.doManageTeams,
                        doManageRoles: this.doManageRoles,
                        doManageTokens: this.doManageTokens,
                        isDisabled: this.props.isDisabled,
                    }}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                    search={this.search}
                    page={this.state.page}
                    term={this.props.term}
                    onTermChange={this.props.onTermChange}
                    rowComponentType={UserListRowWithError}
                />
                <ManageTeamsModal
                    user={this.state.user}
                    show={this.state.showManageTeamsModal}
                    onModalDismissed={this.doManageTeamsDismiss}
                />
                <ManageRolesModal
                    user={this.state.user}
                    show={this.state.showManageRolesModal}
                    onModalDismissed={this.doManageRolesDismiss}
                />
                <ManageTokensModal
                    user={this.state.user}
                    show={this.state.showManageTokensModal}
                    onModalDismissed={this.doManageTokensDismiss}
                    actions={{getUserAccessTokensForUser}}
                />
                <ResetPasswordModal
                    user={this.state.user}
                    show={this.state.showPasswordModal}
                    onModalSubmit={this.doPasswordResetSubmit}
                    onModalDismissed={this.doPasswordResetDismiss}
                />
                <ResetEmailModal
                    user={this.state.user}
                    show={this.state.showEmailModal}
                    onModalSubmit={this.doEmailResetSubmit}
                    onModalDismissed={this.doEmailResetDismiss}
                />
            </div>
        );
    }
}
