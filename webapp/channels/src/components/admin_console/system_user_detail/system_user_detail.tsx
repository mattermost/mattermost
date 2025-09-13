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
import type {UserProfile, UserAuthResponse} from '@mattermost/types/users';

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
    usernameField: string;
    authDataField: string;
    isLoading: boolean;
    error?: string | null;
    emailError?: string | null;
    usernameError?: string | null;
    isSaveNeeded: boolean;
    isSaving: boolean;
    teams: TeamMembership[];
    teamIds: Array<Team['id']>;
    refreshTeams: boolean;
    showResetPasswordModal: boolean;
    showDeactivateMemberModal: boolean;
    showTeamSelectorModal: boolean;
    showSaveConfirmationModal: boolean;
};

export class SystemUserDetail extends PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            emailField: '',
            usernameField: '',
            authDataField: '',
            isLoading: false,
            error: null,
            emailError: null,
            usernameError: null,
            isSaveNeeded: false,
            isSaving: false,
            teams: [],
            teamIds: [],
            refreshTeams: true,
            showResetPasswordModal: false,
            showDeactivateMemberModal: false,
            showTeamSelectorModal: false,
            showSaveConfirmationModal: false,
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
                    usernameField: data.username, // Set usernameField to the username of the user for editing purposes
                    authDataField: data.auth_data || '', // Set authDataField to the auth_data of the user for editing purposes
                    isLoading: false,
                    emailError: null, // Clear any previous errors
                    usernameError: null, // Clear any previous errors
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

            // Show the actual server error message instead of generic message
            const errorMessage = (err as Error).message || this.props.intl.formatMessage({id: 'admin.user_item.userActivateFailed', defaultMessage: 'Failed to activate user'});
            this.setState({error: errorMessage});
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

            // Show the actual server error message instead of generic message
            const errorMessage = (err as Error).message || this.props.intl.formatMessage({id: 'admin.user_item.userDeactivateFailed', defaultMessage: 'Failed to deactivate user'});
            this.setState({error: errorMessage});
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
        if (!this.state.user || this.state.user.auth_service) {
            return;
        }

        const {target: {value}} = event;

        // Validate email
        let emailError = null;
        if (value.trim() && !isEmail(value)) {
            emailError = this.props.intl.formatMessage({id: 'admin.user_item.invalidEmail', defaultMessage: 'Invalid email address'});
        }

        const didEmailChanged = value !== this.state.user.email;
        const didUsernameChanged = !this.state.user.auth_service && this.state.usernameField !== this.state.user.username;
        const didAuthDataChanged = this.state.authDataField !== (this.state.user.auth_data || '');
        const hasChanges = didEmailChanged || didUsernameChanged || didAuthDataChanged;

        this.setState({
            emailField: value,
            emailError,
            isSaveNeeded: hasChanges,
        });

        this.props.setNavigationBlocked(hasChanges);
    };

    handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (!this.state.user || this.state.user.auth_service) {
            return;
        }

        const {target: {value}} = event;

        // Validate username
        let usernameError = null;
        if (!value.trim()) {
            usernameError = this.props.intl.formatMessage({id: 'admin.user_item.invalidUsername', defaultMessage: 'Username cannot be empty'});
        }

        const didEmailChanged = !this.state.user.auth_service && this.state.emailField !== this.state.user.email;
        const didUsernameChanged = value !== this.state.user.username;
        const didAuthDataChanged = this.state.authDataField !== (this.state.user.auth_data || '');
        const hasChanges = didEmailChanged || didUsernameChanged || didAuthDataChanged;

        this.setState({
            usernameField: value,
            usernameError,
            isSaveNeeded: hasChanges,
        });

        this.props.setNavigationBlocked(hasChanges);
    };

    handleAuthDataChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (!this.state.user) {
            return;
        }

        const {target: {value}} = event;

        const didEmailChanged = !this.state.user.auth_service && this.state.emailField !== this.state.user.email;
        const didUsernameChanged = !this.state.user.auth_service && this.state.usernameField !== this.state.user.username;
        const didAuthDataChanged = value !== (this.state.user.auth_data || '');
        const hasChanges = didEmailChanged || didUsernameChanged || didAuthDataChanged;

        this.setState({
            authDataField: value,
            isSaveNeeded: hasChanges,
        });

        this.props.setNavigationBlocked(hasChanges);
    };

    handleSubmit = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

        if (this.state.isLoading || this.state.isSaving || !this.state.user) {
            return;
        }

        // Check for validation errors before proceeding
        if (this.state.emailError || this.state.usernameError) {
            return;
        }

        const emailChanged = !this.state.user.auth_service && this.state.user.email !== this.state.emailField;
        const usernameChanged = !this.state.user.auth_service && this.state.user.username !== this.state.usernameField;
        const authDataChanged = (this.state.user.auth_data || '') !== this.state.authDataField;

        if (!emailChanged && !usernameChanged && !authDataChanged) {
            return;
        }

        // Show confirmation dialog first
        this.setState({showSaveConfirmationModal: true});
    };

    handleConfirmSave = async () => {
        if (!this.state.user) {
            return;
        }

        this.setState({
            error: null,
            isSaving: true,
            showSaveConfirmationModal: false,
        });

        try {
            let userData: UserProfile = this.state.user;

            // Handle email/username updates (only if no auth_service)
            const emailChanged = !this.state.user.auth_service && this.state.emailField !== this.state.user.email;
            const usernameChanged = !this.state.user.auth_service && this.state.usernameField !== this.state.user.username;

            if (emailChanged || usernameChanged) {
                const updatedUser: Partial<UserProfile> = {...this.state.user};

                if (emailChanged) {
                    updatedUser.email = this.state.emailField.trim().toLowerCase();
                }

                if (usernameChanged) {
                    updatedUser.username = this.state.usernameField.trim();
                }

                const {data, error} = await this.props.patchUser(updatedUser as UserProfile) as ActionResult<UserProfile, ServerError>;
                if (data) {
                    userData = data;
                } else {
                    throw new Error(error ? error.message : 'Failed to update user profile');
                }
            }

            // Handle auth_data update
            const authDataChanged = this.state.authDataField !== (this.state.user.auth_data || '');
            if (authDataChanged) {
                const {data, error} = await this.props.updateUserAuth(this.state.user.id, {
                    auth_data: this.state.authDataField.trim(),
                    auth_service: this.state.user.auth_service,
                }) as ActionResult<UserAuthResponse, ServerError>;

                if (data) {
                    // Update the user data with the new auth information
                    userData = {
                        ...userData,
                        auth_data: data.auth_data,
                        auth_service: data.auth_service,
                    };
                } else {
                    throw new Error(error ? error.message : 'Failed to update user auth data');
                }
            }

            this.setState({
                user: userData,
                emailField: userData.email,
                usernameField: userData.username,
                authDataField: userData.auth_data || '',
                error: null,
                emailError: null,
                usernameError: null,
                isSaving: false,
                isSaveNeeded: false,
            });
        } catch (err) {
            console.error('SystemUserDetails-handleConfirmSave', err); // eslint-disable-line no-console

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

    toggleCloseSaveConfirmationModal = () => {
        this.setState({showSaveConfirmationModal: false});
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
                focusOriginElement: 'manageUserSettingsBtn',
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
                focusOriginElement: 'manageUserSettingsBtn',
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
                                    <span>{this.state.user?.position ?? ''}</span>
                                    <label>
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.email'
                                            defaultMessage='Email'
                                        />
                                        <EmailIcon/>
                                        {this.state.user?.auth_service ? (
                                            <WithTooltip
                                                title={this.props.intl.formatMessage({
                                                    id: 'admin.userDetail.managedByProvider.title',
                                                    defaultMessage: 'Managed by login provider',
                                                })}
                                                hint={this.props.intl.formatMessage({
                                                    id: 'admin.userDetail.managedByProvider.email',
                                                    defaultMessage: 'This email is managed by the {authService} login provider and cannot be changed here.',
                                                }, {
                                                    authService: this.state.user.auth_service.toUpperCase(),
                                                })}
                                            >
                                                <input
                                                    className='form-control'
                                                    type='text'
                                                    value={this.state.emailField}
                                                    disabled={true}
                                                    readOnly={true}
                                                    style={{cursor: 'not-allowed'}}
                                                />
                                            </WithTooltip>
                                        ) : (
                                            <>
                                                <input
                                                    className={classNames('form-control', {
                                                        error: this.state.emailError,
                                                    })}
                                                    type='text'
                                                    value={this.state.emailField}
                                                    onChange={this.handleEmailChange}
                                                    disabled={this.state.error !== null || this.state.isSaving}
                                                />
                                                {this.state.emailError && (
                                                    <div className='field-error'>
                                                        {this.state.emailError}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </label>
                                    <label>
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.username'
                                            defaultMessage='Username'
                                        />
                                        <AtIcon/>
                                        {this.state.user?.auth_service ? (
                                            <WithTooltip
                                                title={this.props.intl.formatMessage({
                                                    id: 'admin.userDetail.managedByProvider.title',
                                                    defaultMessage: 'Managed by login provider',
                                                })}
                                                hint={this.props.intl.formatMessage({
                                                    id: 'admin.userDetail.managedByProvider.username',
                                                    defaultMessage: 'This username is managed by the {authService} login provider and cannot be changed here.',
                                                }, {
                                                    authService: this.state.user.auth_service.toUpperCase(),
                                                })}
                                            >
                                                <input
                                                    className='form-control'
                                                    type='text'
                                                    value={this.state.usernameField}
                                                    disabled={true}
                                                    readOnly={true}
                                                    style={{cursor: 'not-allowed'}}
                                                    placeholder='Enter username'
                                                />
                                            </WithTooltip>
                                        ) : (
                                            <>
                                                <input
                                                    className={classNames('form-control', {
                                                        error: this.state.usernameError,
                                                    })}
                                                    type='text'
                                                    value={this.state.usernameField}
                                                    onChange={this.handleUsernameChange}
                                                    disabled={this.state.error !== null || this.state.isSaving}
                                                    placeholder='Enter username'
                                                />
                                                {this.state.usernameError && (
                                                    <div className='field-error'>
                                                        {this.state.usernameError}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </label>
                                    <label>
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.authenticationMethod'
                                            defaultMessage='Authentication Method'
                                        />
                                        <SheidOutlineIcon/>
                                        <span>{getUserAuthenticationTextField(this.props.intl, this.props.mfaEnabled, this.state.user)}</span>
                                    </label>
                                    {this.state.user?.auth_service && (
                                        <label>
                                            <FormattedMessage
                                                id='admin.userManagement.userDetail.authData'
                                                defaultMessage='Auth Data'
                                            />
                                            <SheidOutlineIcon/>
                                            <input
                                                className='form-control'
                                                type='text'
                                                value={this.state.authDataField}
                                                onChange={this.handleAuthDataChange}
                                                disabled={this.state.error !== null || this.state.isSaving}
                                                placeholder='Enter auth data'
                                            />
                                        </label>
                                    )}
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
                                            id='manageUserSettingsBtn'
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
                        disabled={!this.state.isSaveNeeded || this.state.isLoading || this.state.error !== null || this.state.isSaving || this.state.emailError !== null || this.state.usernameError !== null}
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

                <ConfirmModal
                    show={this.state.showSaveConfirmationModal}
                    title={
                        <FormattedMessage
                            id='admin.userDetail.saveChangesModal.title'
                            defaultMessage='Confirm Changes'
                        />
                    }
                    message={
                        <div>
                            <FormattedMessage
                                id='admin.userDetail.saveChangesModal.message'
                                defaultMessage='You are about to save the following changes to {username}:'
                                values={{
                                    username: this.state.user?.username ?? '',
                                }}
                            />
                            <ul style={{marginTop: '10px', marginBottom: '10px'}}>
                                {this.state.user && !this.state.user.auth_service && this.state.emailField !== this.state.user.email && (
                                    <li>
                                        <FormattedMessage
                                            id='admin.userDetail.saveChangesModal.emailChange'
                                            defaultMessage='Email: {oldEmail} → {newEmail}'
                                            values={{
                                                oldEmail: this.state.user.email,
                                                newEmail: this.state.emailField,
                                            }}
                                        />
                                    </li>
                                )}
                                {this.state.user && !this.state.user.auth_service && this.state.usernameField !== this.state.user.username && (
                                    <li>
                                        <FormattedMessage
                                            id='admin.userDetail.saveChangesModal.usernameChange'
                                            defaultMessage='Username: {oldUsername} → {newUsername}'
                                            values={{
                                                oldUsername: this.state.user.username,
                                                newUsername: this.state.usernameField,
                                            }}
                                        />
                                    </li>
                                )}
                                {this.state.user && this.state.authDataField !== (this.state.user.auth_data || '') && (
                                    <li>
                                        <FormattedMessage
                                            id='admin.userDetail.saveChangesModal.authDataChange'
                                            defaultMessage='Auth Data: {oldAuthData} → {newAuthData}'
                                            values={{
                                                oldAuthData: this.state.user.auth_data || '(empty)',
                                                newAuthData: this.state.authDataField || '(empty)',
                                            }}
                                        />
                                    </li>
                                )}
                            </ul>
                            <FormattedMessage
                                id='admin.userDetail.saveChangesModal.warning'
                                defaultMessage='Are you sure you want to proceed with these changes?'
                            />
                        </div>
                    }
                    confirmButtonClass='btn btn-primary'
                    confirmButtonText={
                        <FormattedMessage
                            id='admin.userDetail.saveChangesModal.save'
                            defaultMessage='Save Changes'
                        />
                    }
                    onConfirm={this.handleConfirmSave}
                    onCancel={this.toggleCloseSaveConfirmationModal}
                />
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
