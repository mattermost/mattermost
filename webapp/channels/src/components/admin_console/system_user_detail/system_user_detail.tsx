// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Redirect, RouteComponentProps} from 'react-router-dom';
import {FormattedMessage} from 'react-intl';
import {Overlay} from 'react-bootstrap';

import {isEmail} from 'mattermost-redux/utils/helpers';

import {Team, TeamMembership} from '@mattermost/types/teams';

import {UserProfile} from '@mattermost/types/users';

import {ServerError} from '@mattermost/types/errors';

import {adminResetMfa, adminResetEmail} from 'actions/admin_actions.jsx';

import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';
import {t} from 'utils/i18n';

import BlockableLink from 'components/admin_console/blockable_link';
import ResetPasswordModal from 'components/admin_console/reset_password_modal';
import AdminButtonOutline from 'components/admin_console/admin_button_outline/admin_button_outline';
import AdminUserCard from 'components/admin_console/admin_user_card/admin_user_card';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import ConfirmModal from 'components/confirm_modal';
import SaveButton from 'components/save_button';
import FormError from 'components/form_error';
import TeamSelectorModal from 'components/team_selector_modal';
import Tooltip from 'components/tooltip';

import TeamList from 'components/admin_console/system_user_detail/team_list';
import EmailIcon from 'components/widgets/icons/email_icon';
import AtIcon from 'components/widgets/icons/at_icon';
import SheidOutlineIcon from 'components/widgets/icons/shield_outline_icon';

import './system_user_detail.scss';

export type Props = {
    user: UserProfile;
    mfaEnabled: boolean;
    isDisabled?: boolean;
    actions: {
        updateUserActive: (userId: string, active: boolean) => Promise<{error: ServerError}>;
        setNavigationBlocked: (blocked: boolean) => void;
        addUserToTeam: (teamId: string, userId?: string) => Promise<{data: TeamMembership; error?: any}>;
    };
}

export type State = {
    teams: TeamMembership[];
    teamIds: Array<Team['id']>;
    loading: boolean;
    searching: boolean;
    showPasswordModal: boolean;
    showDeactivateMemberModal: boolean;
    saveNeeded: boolean;
    saving: boolean;
    serverError: string | null;
    errorTooltip: boolean;
    customComponentWrapperClass: string;
    user: UserProfile;
    addTeamOpen: boolean;
    refreshTeams: boolean;
    error: ServerError | null;
}

export default class SystemUserDetail extends React.PureComponent<Props & RouteComponentProps, State> {
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
            teams: [],
            teamIds: [],
            loading: false,
            searching: false,
            showPasswordModal: false,
            showDeactivateMemberModal: false,
            saveNeeded: false,
            saving: false,
            serverError: null,
            errorTooltip: false,
            customComponentWrapperClass: '',
            user: {
                email: this.props.user.email,
            } as UserProfile,
            addTeamOpen: false,
            refreshTeams: true,
            error: null,
        };

        this.errorMessageRef = React.createRef();
    }

    setTeamsData = (teams: TeamMembership[]): void => {
        const teamIds = teams.map((team) => team.team_id);
        this.setState({teams});
        this.setState({teamIds});
        this.setState({refreshTeams: false});
    }

    openAddTeam = (): void => {
        this.setState({addTeamOpen: true});
    }

    addTeams = (teams: Team[]): void => {
        const promises = [];
        for (const team of teams) {
            promises.push(this.props.actions.addUserToTeam(team.id, this.props.user.id));
        }
        Promise.all(promises).finally(() => this.setState({refreshTeams: true}));
    }

    closeAddTeam = (): void => {
        this.setState({addTeamOpen: false});
    }

    doPasswordReset = (user: UserProfile): void => {
        this.setState({
            showPasswordModal: true,
            user,
        });
    }

    doPasswordResetDismiss = (): void => {
        this.setState({
            showPasswordModal: false,
        });
    }

    doPasswordResetSubmit = (): void => {
        this.setState({
            showPasswordModal: false,
        });
    }

    handleMakeActive = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e.preventDefault();
        this.props.actions.updateUserActive(this.props.user.id, true).
            then((data) => this.onUpdateActiveResult(data.error));
    }

    handleShowDeactivateMemberModal = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e.preventDefault();
        this.setState({showDeactivateMemberModal: true});
    }

    handleDeactivateMember = (): void => {
        this.props.actions.updateUserActive(this.props.user.id, false).
            then((data) => this.onUpdateActiveResult(data.error));
        this.setState({showDeactivateMemberModal: false});
    }

    onUpdateActiveResult = (error: ServerError): void => {
        if (error) {
            this.setState({error});
        }
    }

    handleDeactivateCancel = (): void => {
        this.setState({showDeactivateMemberModal: false});
    }

    // TODO: add error handler function
    handleResetMfa = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e.preventDefault();
        adminResetMfa(this.props.user.id, null, null);
    }

    handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const emailChanged = e.target.value !== this.props.user.email;
        this.setState({
            user: {
                email: e.target.value,
            } as UserProfile,
            saveNeeded: emailChanged,
        });
        this.props.actions.setNavigationBlocked(emailChanged);
    }

    handleSubmit = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e.preventDefault();
        if (this.state.user.email !== this.props.user.email) {
            if (!isEmail(this.state.user.email)) {
                this.setState({serverError: 'Invalid Email address'});
                return;
            }
            const user = Object.assign({}, this.props.user);
            const email = this.state.user.email.trim().toLowerCase();
            user.email = email;

            this.setState({serverError: null});

            adminResetEmail(
                user,
                () => {
                    this.props.history.push('/admin_console/user_management/users');
                },
                (err: Error) => {
                    const serverError = (err.message ? err.message : err) as string;
                    this.setState({serverError});
                },
            );

            this.setState({
                saving: false,
                saveNeeded: false,
                serverError: null,
            });
            this.props.actions.setNavigationBlocked(false);
        }
    }

    renderDeactivateMemberModal = (user: UserProfile): React.ReactNode => {
        const title = (
            <FormattedMessage
                id='deactivate_member_modal.title'
                defaultMessage='Deactivate {username}'
                values={{
                    username: user.username,
                }}
            />
        );

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
                        username: user.username,
                    }}
                />
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
    }

    renderActivateDeactivate = (): React.ReactNode => {
        if (this.props.user.delete_at > 0) {
            return (
                <AdminButtonOutline
                    onClick={this.handleMakeActive}
                    className='admin-btn-default'
                    disabled={this.props.isDisabled}
                >
                    {Utils.localizeMessage('admin.user_item.makeActive', 'Activate')}
                </AdminButtonOutline>
            );
        }
        return (
            <AdminButtonOutline
                onClick={this.handleShowDeactivateMemberModal}
                className='admin-btn-default'
                disabled={this.props.isDisabled}
            >
                {Utils.localizeMessage('admin.user_item.makeInactive', 'Deactivate')}
            </AdminButtonOutline>
        );
    }

    renderRemoveMFA = (): React.ReactNode => {
        if (this.props.user.mfa_active) {
            return (
                <AdminButtonOutline
                    onClick={this.handleResetMfa}
                    className='admin-btn-default'
                    disabled={this.props.isDisabled}
                >
                    {Utils.localizeMessage('admin.user_item.resetMfa', 'Remove MFA')}
                </AdminButtonOutline>
            );
        }
        return null;
    }

    getAuthenticationText(): string {
        const {user, mfaEnabled} = this.props;
        let authLine;

        if (user.auth_service) {
            let service;
            if (user.auth_service === Constants.LDAP_SERVICE || user.auth_service === Constants.SAML_SERVICE) {
                service = user.auth_service.toUpperCase();
            } else {
                service = Utils.toTitleCase(user.auth_service);
            }
            authLine = service;
        } else {
            authLine = Utils.localizeMessage('admin.userManagement.userDetail.email', 'Email');
        }
        if (mfaEnabled) {
            if (user.mfa_active) {
                authLine += ', ';
                authLine += Utils.localizeMessage('admin.userManagement.userDetail.mfa', 'MFA');
            }
        }
        return authLine;
    }

    componentDidMount(): void {
        if (this.errorMessageRef.current) {
            this.errorMessageRefCurrent = this.errorMessageRef.current;
        }
    }

    render(): React.ReactNode {
        const {user} = this.props;
        let deactivateMemberModal;

        if (!user.id) {
            return (
                <Redirect to={{pathname: '/admin_console/user_management/users'}}/>
            );
        }

        if (user.id) {
            deactivateMemberModal = this.renderDeactivateMemberModal(user);
        }

        return (
            <div className='SystemUserDetail wrapper--fixed'>
                <div className='admin-console__header with-back'>
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
                </div>
                <div className='admin-console__wrapper'>
                    <div className='admin-console__content'>
                        <AdminUserCard
                            user={user}
                            body={
                                <React.Fragment>
                                    <span className='SystemUserDetail__position'>{user.position}</span>
                                    <span className='SystemUserDetail__field-label'>{Utils.localizeMessage('admin.userManagement.userDetail.email', 'Email')}</span>
                                    <div>
                                        <EmailIcon className='SystemUserDetail__field-icon'/>
                                        <input
                                            className='SystemUserDetail__input form-control'
                                            type='text'
                                            value={this.state.user.email}
                                            onChange={this.handleEmailChange}
                                            disabled={this.props.isDisabled}
                                        />
                                    </div>
                                    <span className='SystemUserDetail__field-label'>{Utils.localizeMessage('admin.userManagement.userDetail.username', 'Username')}</span>
                                    <div>
                                        <AtIcon className='SystemUserDetail__field-icon'/>
                                        <span className='SystemUserDetail__field-text'>{user.username}</span>
                                    </div>
                                    <span className='SystemUserDetail__field-label'>{Utils.localizeMessage('admin.userManagement.userDetail.authenticationMethod', 'Authentication Method')}</span>
                                    <div className='SystemUserDetail__field-text'>
                                        <SheidOutlineIcon className='SystemUserDetail__field-icon'/>
                                        <span className='SystemUserDetail__field-text'>{this.getAuthenticationText()}</span>
                                    </div>
                                </React.Fragment>
                            }
                            footer={
                                <React.Fragment>
                                    <AdminButtonOutline
                                        onClick={this.doPasswordReset}
                                        className='admin-btn-default'
                                        disabled={this.props.isDisabled}
                                    >
                                        {Utils.localizeMessage('admin.user_item.resetPwd', 'Reset Password')}
                                    </AdminButtonOutline>
                                    {this.renderActivateDeactivate()}
                                    {this.renderRemoveMFA()}
                                </React.Fragment>
                            }
                        />
                        <AdminPanel
                            subtitleId={t('admin.userManagement.userDetail.teamsSubtitle')}
                            subtitleDefault={'Teams to which this user belongs'}
                            titleId={t('admin.userManagement.userDetail.teamsTitle')}
                            titleDefault={'Team Membership'}
                            button={(
                                <div className='add-team-button'>
                                    <button
                                        type='button'
                                        className='btn btn-primary'
                                        onClick={this.openAddTeam}
                                        disabled={this.props.isDisabled}
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
                                userId={this.props.user.id}
                                userDetailCallback={this.setTeamsData}
                                refreshTeams={this.state.refreshTeams}
                                readOnly={this.props.isDisabled}
                            />
                        </AdminPanel>
                    </div>
                </div>
                <div className='admin-console-save'>
                    <SaveButton
                        saving={this.state.saving}
                        disabled={!this.state.saveNeeded}
                        onClick={this.handleSubmit}
                        savingMessage={Utils.localizeMessage('admin.saving', 'Saving Config...')}
                    />
                    <div
                        className='error-message'
                        ref={this.errorMessageRef}
                    >
                        <FormError error={this.state.serverError}/>
                    </div>
                    <Overlay
                        show={this.state.errorTooltip}
                        placement='top'
                        target={this.errorMessageRefCurrent}
                    >
                        <Tooltip id='error-tooltip' >
                            {this.state.serverError}
                        </Tooltip>
                    </Overlay>
                </div>
                <ResetPasswordModal
                    user={user}
                    show={this.state.showPasswordModal}
                    onModalSubmit={this.doPasswordResetSubmit}
                    onModalDismissed={this.doPasswordResetDismiss}
                />
                {deactivateMemberModal}
                {this.state.addTeamOpen &&
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
