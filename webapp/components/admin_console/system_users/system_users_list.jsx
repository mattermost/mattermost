// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import ManageTeamsModal from 'components/admin_console/manage_teams_modal/manage_teams_modal.jsx';
import ResetPasswordModal from 'components/admin_console/reset_password_modal.jsx';
import SearchableUserList from 'components/searchable_user_list/searchable_user_list.jsx';

import {getUser} from 'utils/async_client.jsx';
import {Constants} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import SystemUsersDropdown from './system_users_dropdown.jsx';

export default class SystemUsersList extends React.Component {
    static propTypes = {
        users: React.PropTypes.arrayOf(React.PropTypes.object),
        usersPerPage: React.PropTypes.number,
        total: React.PropTypes.number,
        nextPage: React.PropTypes.func,
        search: React.PropTypes.func.isRequired,
        focusOnMount: React.PropTypes.bool,
        renderFilterRow: React.PropTypes.func,

        teamId: React.PropTypes.string.isRequired,
        term: React.PropTypes.string.isRequired,
        onTermChange: React.PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);

        this.nextPage = this.nextPage.bind(this);
        this.previousPage = this.previousPage.bind(this);
        this.search = this.search.bind(this);

        this.doManageTeams = this.doManageTeams.bind(this);
        this.doManageTeamsDismiss = this.doManageTeamsDismiss.bind(this);

        this.doPasswordReset = this.doPasswordReset.bind(this);
        this.doPasswordResetDismiss = this.doPasswordResetDismiss.bind(this);
        this.doPasswordResetSubmit = this.doPasswordResetSubmit.bind(this);

        this.state = {
            page: 0,

            showManageTeamsModal: false,
            showPasswordModal: false,
            user: null
        };
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.teamId !== this.props.teamId) {
            this.setState({page: 0});
        }
    }

    nextPage() {
        this.setState({page: this.state.page + 1});

        this.props.nextPage(this.state.page + 1);
    }

    previousPage() {
        this.setState({page: this.state.page - 1});
    }

    search(term) {
        this.props.search(term);

        if (term !== '') {
            this.setState({page: 0});
        }
    }

    doManageTeams(user) {
        this.setState({
            showManageTeamsModal: true,
            user
        });
    }

    doManageTeamsDismiss() {
        this.setState({
            showManageTeamsModal: false,
            user: null
        });
    }

    doPasswordReset(user) {
        this.setState({
            showPasswordModal: true,
            user
        });
    }

    doPasswordResetDismiss() {
        this.setState({
            showPasswordModal: false,
            user: null
        });
    }

    doPasswordResetSubmit(user) {
        getUser(user.id);

        this.setState({
            showPasswordModal: false,
            user: null
        });
    }

    getInfoForUser(user) {
        const info = [];

        if (user.auth_service) {
            let service;
            if (user.auth_service === Constants.LDAP_SERVICE || user.auth_service === Constants.SAML_SERVICE) {
                service = user.auth_service.toUpperCase();
            } else {
                service = Utils.toTitleCase(user.auth_service);
            }

            info.push(
                <FormattedHTMLMessage
                    key='admin.user_item.authServiceNotEmail'
                    id='admin.user_item.authServiceNotEmail'
                    defaultMessage='<strong>Sign-in Method:</strong> {service}'
                    values={{
                        service
                    }}
                />
            );
        } else {
            info.push(
                <FormattedHTMLMessage
                    key='admin.user_item.authServiceEmail'
                    id='admin.user_item.authServiceEmail'
                    defaultMessage='<strong>Sign-in Method:</strong> Email'
                />
            );
        }

        const mfaEnabled = global.window.mm_license.IsLicensed === 'true' &&
            global.window.mm_license.MFA === 'true' &&
            global.window.mm_config.EnableMultifactorAuthentication === 'true';
        if (mfaEnabled) {
            info.push(', ');

            if (user.mfa_active) {
                info.push(
                    <FormattedHTMLMessage
                        key='admin.user_item.mfaYes'
                        id='admin.user_item.mfaYes'
                        defaultMessage='<strong>MFA</strong>: Yes'
                    />
                );
            } else {
                info.push(
                    <FormattedHTMLMessage
                        key='admin.user_item.mfaNo'
                        id='admin.user_item.mfaNo'
                        defaultMessage='<strong>MFA</strong>: No'
                    />
                );
            }
        }

        return info;
    }

    renderCount(count, total, startCount, endCount, isSearch) {
        if (total) {
            if (isSearch) {
                return (
                    <FormattedMessage
                        id='system_users_list.countSearch'
                        defaultMessage='{count, number} {count, plural, one {user} other {users}} of {total} total'
                        values={{
                            count,
                            total
                        }}
                    />
                );
            } else if (startCount !== 0 || endCount !== total) {
                return (
                    <FormattedMessage
                        id='system_users_list.countPage'
                        defaultMessage='{startCount, number} - {endCount, number} {count, plural, one {user} other {users}} of {total} total'
                        values={{
                            count,
                            startCount: startCount + 1,
                            endCount,
                            total
                        }}
                    />
                );
            }

            return (
                <FormattedMessage
                    id='system_users_list.count'
                    defaultMessage='{count, number} {count, plural, one {user} other {users}}'
                    values={{
                        count
                    }}
                />
            );
        }

        return null;
    }

    render() {
        const extraInfo = {};
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
                        doPasswordReset: this.doPasswordReset,
                        doManageTeams: this.doManageTeams
                    }}
                    nextPage={this.nextPage}
                    previousPage={this.previousPage}
                    search={this.search}
                    page={this.state.page}
                    term={this.props.term}
                    onTermChange={this.props.onTermChange}
                />
                <ManageTeamsModal
                    user={this.state.user}
                    show={this.state.showManageTeamsModal}
                    onModalDismissed={this.doManageTeamsDismiss}
                />
                <ResetPasswordModal
                    user={this.state.user}
                    show={this.state.showPasswordModal}
                    onModalSubmit={this.doPasswordResetSubmit}
                    onModalDismissed={this.doPasswordResetDismiss}
                />
            </div>
        );
    }
}
