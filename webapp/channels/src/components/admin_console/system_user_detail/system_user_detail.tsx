// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ChangeEvent, MouseEvent} from 'react';
import type {WrappedComponentProps} from 'react-intl';
import {FormattedMessage, injectIntl} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import type {ServerError} from '@mattermost/types/errors';
import type {Team, TeamMembership} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {isEmail} from 'mattermost-redux/utils/helpers';

import {adminResetMfa} from 'actions/admin_actions.jsx';

import AdminUserCard from 'components/admin_console/admin_user_card/admin_user_card';
import BlockableLink from 'components/admin_console/blockable_link';
import ResetPasswordModal from 'components/admin_console/reset_password_modal';
import TeamList from 'components/admin_console/system_user_detail/team_list';
import ConfirmModal from 'components/confirm_modal';
import FormError from 'components/form_error';
import SaveButton from 'components/save_button';
import TeamSelectorModal from 'components/team_selector_modal';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import AtIcon from 'components/widgets/icons/at_icon';
import EmailIcon from 'components/widgets/icons/email_icon';
import SheidOutlineIcon from 'components/widgets/icons/shield_outline_icon';

import {Constants} from 'utils/constants';
import {toTitleCase} from 'utils/utils';

import type {PropsFromRedux} from './index';

import './system_user_detail.scss';

type Params = {
    user_id?: UserProfile['id'];
}

type Props = PropsFromRedux & RouteComponentProps<Params> & WrappedComponentProps;

export type State = {
    user: UserProfile;
    emailField: string;
    error?: string | null;
    teams: TeamMembership[];
    teamIds: Array<Team['id']>;
    loading: boolean;
    searching: boolean;
    saveNeeded: boolean;
    saving: boolean;
    serverError: string | null;
    errorTooltip: boolean;
    customComponentWrapperClass: string;
    refreshTeams: boolean;
    showResetPasswordModal: boolean;
    showDeactivateMemberModal: boolean;
    showTeamSelectorModal: boolean;
}

class SystemUserDetail extends React.PureComponent<Props & RouteComponentProps, State> {
    errorMessageRef: React.RefObject<HTMLDivElement>;
    errorMessageRefCurrent: React.ReactInstance | undefined;

    public static defaultProps = {
        user: {
            email: '',
        } as UserProfile,
        mfaEnabled: false,
    };

    constructor(props: Props & RouteComponentProps) {
        super(props);
        this.state = {
            user: {} as UserProfile,
            emailField: '',
            teams: [],
            teamIds: [],
            loading: false,
            searching: false,
            showResetPasswordModal: false,
            showDeactivateMemberModal: false,
            saveNeeded: false,
            saving: false,
            serverError: null,
            errorTooltip: false,
            customComponentWrapperClass: '',
            showTeamSelectorModal: false,
            refreshTeams: true,
            error: null,
        };

        this.errorMessageRef = React.createRef();
    }

    getUser = async (userId: UserProfile['id']) => {
        this.setState({loading: true});

        try {
            const {data, error} = await this.props.getUser(userId);
            if (data) {
                this.setState({
                    user: data,
                    emailField: data.email, // Set emailField to the email of the user for editing purposes
                    loading: false,
                });
            } else {
                throw new Error(error);
            }
        } catch (error) {
            console.log('SystemUserDetails-getUser: ', error); // eslint-disable-line no-console

            this.setState({
                loading: false,
                error: this.props.intl.formatMessage({id: 'admin.user_item.userNotFound', defaultMessage: 'Cannot load User'}),
            });
        }
    };

    componentDidMount(): void {
        if (this.errorMessageRef.current) {
            this.errorMessageRefCurrent = this.errorMessageRef.current;
        }

        const userId = this.props.match.params.user_id ?? '';
        if (userId.length !== 0) {
            // We dont have to handle the case of userId being empty here because the redirect will take care of it from the parent components
            this.getUser(userId);
        }
    }

    setTeamsData = (teams: TeamMembership[]): void => {
        const teamIds = teams.map((team) => team.team_id);
        this.setState({teams});
        this.setState({teamIds});
        this.setState({refreshTeams: false});
    };

    openAddTeam = (): void => {
        this.setState({showTeamSelectorModal: true});
    };

    addTeams = (teams: Team[]): void => {
        const promises = [];
        for (const team of teams) {
            promises.push(this.props.actions.addUserToTeam(team.id, this.props.user.id));
        }
        Promise.all(promises).finally(() => this.setState({refreshTeams: true}));
    };

    closeAddTeam = (): void => {
        this.setState({showTeamSelectorModal: false});
    };

    handleActivateUser = async () => {
        try {
            const {error} = await this.props.updateUserActive(this.state.user.id, true);
            if (error) {
                throw new Error(error.message);
            }
        } catch (err) {
            this.setState({error: err});
        }

        // this.props.updateUserActive(this.props.user.id, true).
        //     then((data) => this.onUpdateActiveResult(data.error));
    };

    /**
     * Modal close/open handlers
     */

    toggleOpenModalDeactivateMember = () => {
        this.setState({showDeactivateMemberModal: true});
    };

    toggleCloseModalDeactivateMember = (): void => {
        this.setState({showDeactivateMemberModal: false});
    };

    toggleOpenModalResetPassword = () => {
        this.setState({showResetPasswordModal: true});
    };

    toggleCloseModalResetPassword = () => {
        this.setState({showResetPasswordModal: false});
    };

    handleDeactivateMember = (): void => {
        this.props.actions.updateUserActive(this.props.user.id, false).
            then((data) => this.onUpdateActiveResult(data.error));
        this.setState({showDeactivateMemberModal: false});
    };

    onUpdateActiveResult = (error: ServerError): void => {
        if (error) {
            this.setState({error});
        }
    };

    // TODO: add error handler function
    handleResetMfa = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e.preventDefault();
        adminResetMfa(this.props.user.id, null, null);
    };

    handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
        const {target: {value}} = event;

        const didEmailChanged = value !== this.state.user.email;
        this.setState({
            emailField: value,
            saveNeeded: didEmailChanged,
        });

        this.props.setNavigationBlocked(didEmailChanged);
    };

    handleSubmit = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();

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
            saving: true,
        });

        try {
            const {data, error} = await this.props.patchUser(updatedUser);
            if (data) {
                this.setState({
                    user: data,
                    emailField: data.email,
                    error: null,
                    saving: false,
                    saveNeeded: false,
                });
            } else {
                throw new Error(error);
            }
        } catch (err) {
            console.error('SystemUserDetails-handleSubmit', err); // eslint-disable-line no-console

            this.setState({
                error: this.props.intl.formatMessage({id: 'admin.user_item.userUpdateFailed', defaultMessage: 'Failed to update user'}),
                saving: false,
                saveNeeded: false,
            });
        }

        this.props.setNavigationBlocked(false);
    };

    renderDeactivateMemberModal = (user: UserProfile): React.ReactNode => {
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

        const message = (
            <div>
                <FormattedMessage
                    id='deactivate_member_modal.desc'
                    defaultMessage='This action deactivates {username}. They will be logged out and not have access to any teams or channels on this system. Are you sure you want to deactivate {username}?'
                    values={{
                        username: user?.username ?? '',
                    }}
                />
                {warning}
            </div>
        );

        return (
            <ConfirmModal
                show={this.state.showDeactivateMemberModal}
                title={
                    <FormattedMessage
                        id='deactivate_member_modal.title'
                        defaultMessage='Deactivate {username}'
                        values={{
                            username: user?.username ?? '',
                        }}
                    />
                }
                message={message}
                confirmButtonClass={'btn btn-danger'}
                confirmButtonText={
                    <FormattedMessage
                        id='deactivate_member_modal.deactivate'
                        defaultMessage='Deactivate'
                    />
                }
                onConfirm={this.handleDeactivateMember}
                onCancel={this.toggleCloseModalDeactivateMember}
            />
        );
    };

    getUserAuthenticationTextField(user: UserProfile, mfaEnabled: Props['mfaEnabled']): string {
        let authLine;

        if (user.auth_service) {
            let service;
            if (user.auth_service === Constants.LDAP_SERVICE || user.auth_service === Constants.SAML_SERVICE) {
                service = user.auth_service.toUpperCase();
            } else {
                service = toTitleCase(user.auth_service);
            }
            authLine = service;
        } else {
            authLine = this.props.intl.formatMessage({id: 'admin.userManagement.userDetail.email', defaultMessage: 'Email'});
        }

        if (mfaEnabled) {
            if (user.mfa_active) {
                authLine += ', ';
                authLine += this.props.intl.formatMessage({id: 'admin.userManagement.userDetail.mfa', defaultMessage: 'MFA'});
            }
        }

        return authLine;
    }

    render(): React.ReactNode {
        // TODO - add this back in
        // if (user.id) {
        //     deactivateMemberModal = this.renderDeactivateMemberModal(user);
        // }

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
                        <AdminUserCard
                            user={this.state.user}
                            body={
                                <>
                                    <span>{this.state.user.position}</span>
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
                                            disabled={this.state.serverError !== null}
                                        />
                                    </label>
                                    <label>
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.username'
                                            defaultMessage='Username'
                                        />
                                        <AtIcon/>
                                        <span>{this.state.user.username}</span>
                                    </label>
                                    <label>
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.authenticationMethod'
                                            defaultMessage='Authentication Method'
                                        />
                                        <SheidOutlineIcon/>
                                        <span>{this.getUserAuthenticationTextField(this.state.user, this.props.mfaEnabled)}</span>
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
                                    {this.state.user.delete_at !== 0 && (
                                        <button
                                            className='btn btn-secondary'
                                            onClick={this.handleActivateUser}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.makeActive'
                                                defaultMessage='Activate'
                                            />
                                        </button>
                                    )}
                                    {this.state.user.delete_at === 0 && (
                                        <button
                                            className='btn btn-secondary btn-danger'
                                            onClick={this.toggleOpenModalDeactivateMember}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.deactivate'
                                                defaultMessage='Deactivate'
                                            />
                                        </button>
                                    )}
                                    {this.state.user.mfa_active &&
                                        <button
                                            className='btn btn-secondary btn-danger'
                                            onClick={this.handleResetMfa}
                                        >
                                            <FormattedMessage
                                                id='admin.user_item.resetMfa'
                                                defaultMessage='Remove MFA'
                                            />
                                        </button>
                                    }
                                </>
                            }
                        />
                        <AdminPanel
                            title={
                                <FormattedMessage
                                    id='admin.userManagement.userDetail.teamsTitle'
                                    defaultMessage='Team Membership'
                                />
                            }
                            subtitle={
                                <FormattedMessage
                                    id='admin.userManagement.userDetail.teamsSubtitle'
                                    defaultMessage='Teams to which this user belongs'
                                />
                            }
                            button={(
                                <div className='add-team-button'>
                                    <button
                                        type='button'
                                        className='btn btn-primary'
                                        onClick={this.openAddTeam}
                                    >
                                        <FormattedMessage
                                            id='admin.userManagement.userDetail.addTeam'
                                            defaultMessage='Add Team'
                                        />
                                    </button>
                                </div>
                            )}
                        >
                            <TeamList
                                userId={this.state.user.id}
                                userDetailCallback={this.setTeamsData}
                                refreshTeams={this.state.refreshTeams}
                            />
                        </AdminPanel>
                    </div>
                </div>
                <div className='admin-console-save'>
                    <SaveButton
                        saving={this.state.saving}
                        disabled={!this.state.saveNeeded}
                        onClick={this.handleSubmit}
                    />
                    <div
                        className='error-message'
                    >
                        <FormError error={this.state.error}/>
                    </div>
                </div>
                <ResetPasswordModal
                    show={this.state.showResetPasswordModal}
                    user={this.state.user}
                    onModalSubmit={this.toggleCloseModalResetPassword}
                    onModalDismissed={this.toggleCloseModalResetPassword}
                />
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
                    // message={message}
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
                {this.state.showTeamSelectorModal &&
                    <TeamSelectorModal
                        onModalDismissed={this.closeAddTeam}
                        onTeamsSelected={this.addTeams}
                        alreadySelected={this.state.teamIds}
                        excludeGroupConstrained={true}
                    />
                }
            </div>
        );
    }
}

export default injectIntl(SystemUserDetail);
