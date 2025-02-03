// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {PureComponent} from 'react';
import type {ChangeEvent, MouseEvent} from 'react';
import type {IntlShape, WrappedComponentProps} from 'react-intl';
import {FormattedMessage, defineMessage, injectIntl} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import type {ServerError} from '@mattermost/types/errors';
import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';
import {isEmail} from 'mattermost-redux/utils/helpers';

import AdminUserCard from 'components/admin_console/admin_user_card/admin_user_card';
import BlockableLink from 'components/admin_console/blockable_link';
import ResetPasswordModal from 'components/admin_console/reset_password_modal';
import TeamList from 'components/admin_console/system_user_detail/team_list';
import ConfirmManageUserSettingsModal from 'components/admin_console/system_users/system_users_list_actions/confirm_manage_user_settings_modal';
import ConfirmModal from 'components/confirm_modal';
import FormError from 'components/form_error';
import SaveButton from 'components/save_button';
import TeamSelectorModal from 'components/team_selector_modal';
import UserSettingsModal from 'components/user_settings/modal';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import AtIcon from 'components/widgets/icons/at_icon';
import EmailIcon from 'components/widgets/icons/email_icon';
import SheidOutlineIcon from 'components/widgets/icons/shield_outline_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import WithTooltip from 'components/with_tooltip';

import {Constants, ModalIdentifiers} from 'utils/constants';
import {toTitleCase} from 'utils/utils';

import type {PropsFromRedux} from './index';

import './system_user_detail.scss';

export type Params = {
    user_id?: UserProfile['id'];
};

export type Props = PropsFromRedux & RouteComponentProps<Params> & WrappedComponentProps;

export type State = {
    user?: UserProfile;
    emailField: string;
    isLoading: boolean;
    error?: string | null;
    isSaveNeeded: boolean;
    isSaving: boolean;
    teams: TeamMembership[];
    teamIds: Array<Team['id']>;
    refreshTeams: boolean;
    showResetPasswordModal: boolean;
    showDeactivateMemberModal: boolean;
    showTeamSelectorModal: boolean;
};

export class SystemUserDetail extends PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            emailField: '',
            isLoading: false,
            error: null,
            isSaveNeeded: false,
            isSaving: false,
            teams: [],
            teamIds: [],
            refreshTeams: true,
            showResetPasswordModal: false,
            showDeactivateMemberModal: false,
            showTeamSelectorModal: false,
        };
    }

    getUser = async (userId: UserProfile['id']) => {
        this.setState({isLoading: true});

        try {
            const {data, error} = await this.props.getUser(userId) as ActionResult<UserProfile, ServerError>;
            if (data) {
                this.setState({
                    user: data,
                    emailField: data.email, // Set emailField to the email of the user for editing purposes
                    isLoading: false,
                });
            } else {
                throw new Error(error ? error.message : 'Unknown error');
            }
        } catch (error) {
            console.log('SystemUserDetails-getUser: ', error); // eslint-disable-line no-console

            this.setState({
                isLoading: false,
                error: this.props.intl.formatMessage({id: 'admin.user_item.userNotFound', defaultMessage: 'Cannot load User'}),
            });
        }
    };

    componentDidMount() {
        const userId = this.props.match.params.user_id ?? '';
        if (userId) {
            // We dont have to handle the case of userId being empty here because the redirect will take care of it from the parent components
            this.getUser(userId);
        }
    }

    handleTeamsLoaded = (teams: TeamMembership[]) => {
        const teamIds = teams.map((team) => team.team_id);
        this.setState({teams});
        this.setState({teamIds});
        this.setState({refreshTeams: false});
    };

    handleAddUserToTeams = (teams: Team[]) => {
        if (!this.state.user) {
            return;
        }

        const promises = [];
        for (const team of teams) {
            promises.push(this.props.addUserToTeam(team.id, this.state.user.id));
        }
        Promise.all(promises).finally(() =>
            this.setState({refreshTeams: true}),
        );
    };

    handleActivateUser = async () => {
        if (!this.state.user || this.state.user?.auth_service === Constants.LDAP_SERVICE) {
            return;
        }

        try {
            const {error} = await this.props.updateUserActive(this.state.user.id, true) as ActionResult<boolean, ServerError>;
            if (error) {
                throw new Error(error.message);
            }

            await this.getUser(this.state.user.id);
        } catch (err) {
            console.error('SystemUserDetails-handleActivateUser', err); // eslint-disable-line no-console

            this.setState({error: this.props.intl.formatMessage({id: 'admin.user_item.userActivateFailed', defaultMessage: 'Failed to activate user'})});
        }
    };

    handleDeactivateMember = async () => {
        if (!this.state.user) {
            return;
        }

        try {
            const {error} = await this.props.updateUserActive(this.state.user.id, false) as ActionResult<boolean, ServerError>;
            if (error) {
                throw new Error(error.message);
            }

            await this.getUser(this.state.user.id);
        } catch (err) {
            console.error('SystemUserDetails-handleDeactivateMember', err); // eslint-disable-line no-console

            this.setState({error: this.props.intl.formatMessage({id: 'admin.user_item.userDeactivateFailed', defaultMessage: 'Failed to deactivate user'})});
        }

        this.toggleCloseModalDeactivateMember();
    };

    handleRemoveMFA = async () => {
        if (!this.state.user) {
            return;
        }

        try {
            const {error} = await this.props.updateUserMfa(this.state.user.id, false) as ActionResult<boolean, ServerError>;
            if (error) {
                throw new Error(error.message);
            }

            await this.getUser(this.state.user.id);
        } catch (err) {
            console.error('SystemUserDetails-handleRemoveMFA', err); // eslint-disable-line no-console

            this.setState({error: this.props.intl.formatMessage({id: 'admin.user_item.userMFARemoveFailed', defaultMessage: 'Failed to remove user\'s MFA'})});
        }
    };

    handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (!this.state.user) {
            return;
        }

        const {target: {value}} = event;

        const didEmailChanged = value !== this.state.user.email;
        this.setState({
            emailField: value,
            isSaveNeeded: didEmailChanged,
        });

        this.props.setNavigationBlocked(didEmailChanged);
    };

    handleSubmit = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        if (this.state.isLoading || this.state.isSaving || !this.state.user) {
            return;
        }

        if (this.state.user.email === this.state.emailField) {
            return;
        }

        if (!isEmail(this.state.user.email)) {
            this.setState({error: this.props.intl.formatMessage({id: 'admin.user_item.invalidEmail', defaultMessage: 'Invalid email address'})});
            return;
        }

        const updatedUser = Object.assign({}, this.state.user, {email: this.state.emailField.trim().toLowerCase()});

        this.setState({
            error: null,
            isSaving: true,
        });

        try {
            const {data, error} = await this.props.patchUser(updatedUser) as ActionResult<UserProfile, ServerError>;
            if (data) {
                this.setState({
                    user: data,
                    emailField: data.email,
                    error: null,
                    isSaving: false,
                    isSaveNeeded: false,
                });
            } else {
                throw new Error(error ? error.message : 'Unknown error');
            }
        } catch (err) {
            console.error('SystemUserDetails-handleSubmit', err); // eslint-disable-line no-console

            this.setState({
                error: this.props.intl.formatMessage({id: 'admin.user_item.userUpdateFailed', defaultMessage: 'Failed to update user'}),
                isSaving: false,
                isSaveNeeded: false,
            });
        }

        this.props.setNavigationBlocked(false);
    };

    /**
     * Modal close/open handlers
     */

    toggleOpenModalDeactivateMember = () => {
        if (this.state.user?.auth_service === Constants.LDAP_SERVICE) {
            return;
        }
        this.setState({showDeactivateMemberModal: true});
    };

    toggleCloseModalDeactivateMember = () => {
        this.setState({showDeactivateMemberModal: false});
    };

    toggleOpenModalResetPassword = () => {
        this.props.openModal({
            modalId: ModalIdentifiers.RESET_PASSWORD_MODAL,
            dialogType: ResetPasswordModal,
            dialogProps: {user: this.state.user},
        });
    };

    toggleCloseModalResetPassword = () => {
        this.setState({showResetPasswordModal: false});
    };

    toggleOpenTeamSelectorModal = () => {
        this.setState({showTeamSelectorModal: true});
    };

    toggleCloseTeamSelectorModal = () => {
        this.setState({showTeamSelectorModal: false});
    };

    openConfirmEditUserSettingsModal = () => {
        if (!this.state.user) {
            return;
        }

        this.props.openModal({
            modalId: ModalIdentifiers.CONFIRM_MANAGE_USER_SETTINGS_MODAL,
            dialogType: ConfirmManageUserSettingsModal,
            dialogProps: {
                user: this.state.user,
                onConfirm: this.openUserSettingsModal,
            },
        });
    };

    openUserSettingsModal = async () => {
        if (!this.state.user) {
            return;
        }

        this.props.openModal({
            modalId: ModalIdentifiers.USER_SETTINGS,
            dialogType: UserSettingsModal,
            dialogProps: {
                adminMode: true,
                isContentProductSettings: true,
                userID: this.state.user.id,
            },
        });
    };

    getManagedByLdapText = () => {
        if (this.state.user?.auth_service !== Constants.LDAP_SERVICE) {
            return null;
        }
        return (
            <>
                {' '}
                <FormattedMessage
                    id='admin.user_item.managedByLdap'
                    defaultMessage='(Managed By LDAP)'
                />
            </>
        );
    };

    render() {
        return (
            <div className='SystemUserDetail wrapper--fixed'>
                <AdminHeader withBackButton={true}>
                    <div>
                        <BlockableLink
                            to='/admin_console/user_management/users'
                            className='fa fa-angle-left back'
                        />
                        <FormattedMessage
                            id='admin.systemUserDetail.title'
                            defaultMessage='User Configuration'
                        />
                    </div>
                </AdminHeader>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>

                        {/* User details */}
                        <AdminUserCard
                            user={this.state.user}
                            isLoading={this.state.isLoading}
                            body={
                                <>
                                    <span>{this.state?.user?.position ?? ''}</span>
                                    <label>
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.email'
                                            defaultMessage='Email'
                                        />
                                        <EmailIcon/>
                                        <input
                                            className='form-control'
                                            type='text'
                                            value={this.state.emailField}
                                            onChange={this.handleEmailChange}
                                            disabled={this.state.error !== null || this.state.isSaving}
                                        />
                                    </label>
                                    <label>
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.username'
                                            defaultMessage='Username'
                                        />
                                        <AtIcon/>
                                        <span>{this.state?.user?.username}</span>
                                    </label>
                                    <label>
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.authenticationMethod'
                                            defaultMessage='Authentication Method'
                                        />
                                        <SheidOutlineIcon/>
                                        <span>{getUserAuthenticationTextField(this.props.intl, this.props.mfaEnabled, this.state.user)}</span>
                                    </label>
                                </>
                            }
                            footer={
                                <>
                                    <button
                                        className='btn btn-secondary'
                                        onClick={this.toggleOpenModalResetPassword}
                                    >
                                        <FormattedMessage
                                            id='admin.user_item.resetPwd'
                                            defaultMessage='Reset Password'
                                        />
                                    </button>
                                    {this.state.user?.mfa_active && (
                                        <button
                                            className='btn btn-secondary'
                                            onClick={this.handleRemoveMFA}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.resetMfa'
                                                defaultMessage='Remove MFA'
                                            />
                                        </button>
                                    )}
                                    {this.state.user?.delete_at !== 0 && (
                                        <button
                                            className='btn btn-secondary'
                                            onClick={this.handleActivateUser}
                                            disabled={this.state.user?.auth_service === Constants.LDAP_SERVICE}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.makeActive'
                                                defaultMessage='Activate'
                                            />
                                            {this.getManagedByLdapText()}
                                        </button>
                                    )}
                                    {this.state.user?.delete_at === 0 && (
                                        <button
                                            className='btn btn-secondary btn-danger'
                                            onClick={this.toggleOpenModalDeactivateMember}
                                            disabled={this.state.user?.auth_service === Constants.LDAP_SERVICE}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.deactivate'
                                                defaultMessage='Deactivate'
                                            />
                                            {this.getManagedByLdapText()}
                                        </button>
                                    )}

                                    {
                                        this.props.showManageUserSettings &&
                                        <button
                                            className='manageUserSettingsBtn btn btn-tertiary'
                                            onClick={this.openConfirmEditUserSettingsModal}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.manageSettings'
                                                defaultMessage='Manage User Settings'
                                            />
                                        </button>
                                    }

                                    {
                                        this.props.showLockedManageUserSettings &&
                                        <WithTooltip
                                            title={defineMessage({
                                                id: 'generic.enterprise_feature',
                                                defaultMessage: 'Enterprise feature',
                                            })}
                                            hint={defineMessage({
                                                id: 'admin.user_item.manageSettings.disabled_tooltip',
                                                defaultMessage: 'Please upgrade to Enterprise to manage user settings',
                                            })}
                                        >
                                            <button
                                                className='manageUserSettingsBtn btn disabled'
                                            >
                                                <div className='RestrictedIndicator__content'>
                                                    <i className={classNames('RestrictedIndicator__icon-tooltip', 'icon', 'icon-key-variant')}/>
                                                </div>
                                                <FormattedMessage
                                                    id='admin.user_item.manageSettings'
                                                    defaultMessage='Manage User Settings'
                                                />
                                            </button>
                                        </WithTooltip>
                                    }
                                </>
                            }
                        />

                        {/* User's team details */}
                        <AdminPanel
                            title={defineMessage({
                                id: 'admin.userManagement.userDetail.teamsTitle',
                                defaultMessage: 'Team Membership',
                            })}
                            subtitle={defineMessage({
                                id: 'admin.userManagement.userDetail.teamsSubtitle',
                                defaultMessage: 'Teams to which this user belongs',
                            })}
                            button={
                                <div className='add-team-button'>
                                    <button
                                        type='button'
                                        className='btn btn-primary'
                                        onClick={this.toggleOpenTeamSelectorModal}
                                        disabled={this.state.isLoading || this.state.error !== null}
                                    >
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.addTeam'
                                            defaultMessage='Add Team'
                                        />
                                    </button>
                                </div>
                            }
                        >
                            {this.state.isLoading && (
                                <div className='teamlistLoading'>
                                    <LoadingSpinner/>
                                </div>
                            )}
                            {!this.state.isLoading && this.state.user?.id && (
                                <TeamList
                                    userId={this.state.user.id}
                                    userDetailCallback={this.handleTeamsLoaded}
                                    refreshTeams={this.state.refreshTeams}
                                />
                            )}
                        </AdminPanel>
                    </div>
                </div>

                {/* Footer */}
                <div className='admin-console-save'>
                    <SaveButton
                        saving={this.state.isSaving}
                        disabled={!this.state.isSaveNeeded || this.state.isLoading || this.state.error !== null || this.state.isSaving}
                        onClick={this.handleSubmit}
                    />
                    <div className='error-message'>
                        <FormError error={this.state.error}/>
                    </div>
                </div>
                {/* mounting of Modals */}
                <ConfirmModal
                    show={this.state.showDeactivateMemberModal}
                    title={
                        <FormattedMessage
                            id='deactivate_member_modal.title'
                            defaultMessage='Deactivate {username}'
                            values={{
                                username: this.state.user?.username ?? '',
                            }}
                        />
                    }
                    message={
                        <div>
                            <FormattedMessage
                                id='deactivate_member_modal.desc'
                                defaultMessage='This action deactivates {username}. They will be logged out and not have access to any teams or channels on this system. Are you sure you want to deactivate {username}?'
                                values={{
                                    username: this.state.user?.username ?? '',
                                }}
                            />
                            {this.state.user?.auth_service !== '' && this.state.user?.auth_service !== Constants.EMAIL_SERVICE && (
                                <strong>
                                    <br/>
                                    <br/>
                                    <FormattedMessage
                                        id='deactivate_member_modal.sso_warning'
                                        defaultMessage='You must also deactivate this user in the SSO provider or they will be reactivated on next login or sync.'
                                    />
                                </strong>
                            )}
                        </div>
                    }
                    confirmButtonClass='btn btn-danger'
                    confirmButtonText={
                        <FormattedMessage
                            id='deactivate_member_modal.deactivate'
                            defaultMessage='Deactivate'
                        />
                    }
                    onConfirm={this.handleDeactivateMember}
                    onCancel={this.toggleCloseModalDeactivateMember}
                />

                {this.state.showTeamSelectorModal && (
                    <TeamSelectorModal
                        onModalDismissed={this.toggleCloseTeamSelectorModal}
                        onTeamsSelected={this.handleAddUserToTeams}
                        alreadySelected={this.state.teamIds}
                        excludeGroupConstrained={true}
                    />
                )}
            </div>
        );
    }
}

export default injectIntl(SystemUserDetail);

export function getUserAuthenticationTextField(intl: IntlShape, mfaEnabled: Props['mfaEnabled'], user?: UserProfile): string {
    if (!user) {
        return '';
    }

    let authenticationTextField;

    if (user.auth_service) {
        let service;
        if (user.auth_service === Constants.LDAP_SERVICE || user.auth_service === Constants.SAML_SERVICE) {
            service = user.auth_service.toUpperCase();
        } else if (user.auth_service === Constants.OFFICE365_SERVICE) {
            // override service name office365 to text Entra ID
            service = intl.formatMessage({
                id: 'admin.oauth.office365',
                defaultMessage: 'Entra ID',
            });
        } else {
            service = toTitleCase(user.auth_service);
        }
        authenticationTextField = service;
    } else {
        authenticationTextField = intl.formatMessage({
            id: 'admin.userManagement.userDetail.email',
            defaultMessage: 'Email',
        });
    }

    if (mfaEnabled) {
        if (user.mfa_active) {
            authenticationTextField += ', ';
            authenticationTextField += intl.formatMessage({id: 'admin.userManagement.userDetail.mfa', defaultMessage: 'MFA'});
        }
    }

    return authenticationTextField;
}
