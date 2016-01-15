// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {intlShape, injectIntl, defineMessages} from 'react-intl';
import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import AccessHistoryModal from '../access_history_modal.jsx';
import ActivityLogModal from '../activity_log_modal.jsx';
import ToggleModalButton from '../toggle_modal_button.jsx';

import TeamStore from '../../stores/team_store.jsx';

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import Constants from '../../utils/constants.jsx';

const messages = defineMessages({
    currentPasswordError: {
        id: 'user.settings.security.currentPasswordError',
        defaultMessage: 'Please enter your current password'
    },
    passwordLengthError: {
        id: 'user.settings.security.passwordLengthError',
        defaultMessage: 'New passwords must be at least 5 characters'
    },
    passwordMatchError: {
        id: 'user.settings.security.passwordMatchError',
        defaultMessage: 'The new passwords you entered do not match'
    },
    currentPassword: {
        id: 'user.settings.security.currentPassword',
        defaultMessage: 'Current Password'
    },
    newPassword: {
        id: 'user.settings.security.newPassword',
        defaultMessage: 'New Password'
    },
    retypePassword: {
        id: 'user.settings.security.retypePassword',
        defaultMessage: 'Retype New Password'
    },
    authService: {
        id: 'user.settings.security.authService',
        defaultMessage: 'Log in occurs through SSO. Please see your SSO account settings page to update your password.'
    },
    password: {
        id: 'user.settings.security.password',
        defaultMessage: 'Password'
    },
    lastUpdated: {
        id: 'user.settings.security.lastUpdated',
        defaultMessage: 'Last updated '
    },
    at: {
        id: 'user.settings.security.at',
        defaultMessage: ' at '
    },
    loginService: {
        id: 'user.settings.security.loginService',
        defaultMessage: 'Log in done through SSO'
    },
    close: {
        id: 'user.settings.security.close',
        defaultMessage: 'Close'
    },
    title: {
        id: 'user.settings.security.title',
        defaultMessage: 'Security Settings'
    },
    version: {
        id: 'user.settings.security.version',
        defaultMessage: 'Version '
    },
    buildNumber: {
        id: 'user.settings.security.buildNumber',
        defaultMessage: 'Build Number: '
    },
    buildDate: {
        id: 'user.settings.security.buildDate',
        defaultMessage: 'Build Date: '
    },
    buildHash: {
        id: 'user.settings.security.buildHash',
        defaultMessage: 'Build Hash: '
    },
    viewHistory: {
        id: 'user.settings.security.viewHistory',
        defaultMessage: 'View Access History'
    },
    logoutActiveSessions: {
        id: 'user.settings.security.logoutActiveSessions',
        defaultMessage: 'View and Logout of Active Sessions'
    },
    switchEmail: {
        id: 'user.settings.security.switchEmail',
        defaultMessage: 'Switch to using email and password'
    },
    switchGitlab: {
        id: 'user.settings.security.switchGitlab',
        defaultMessage: 'Switch to using GitLab SSO'
    },
    switchGoogle: {
        id: 'user.settings.security.switchGoogle',
        defaultMessage: 'Switch to using Google SSO'
    },
    oneSignin: {
        id: 'user.settings.security.oneSignin',
        defaultMessage: 'You may only have one sign-in method at a time. Switching sign-in method will send an email notifying you if the change was successful.'
    },
    method: {
        id: 'user.settings.security.method',
        defaultMessage: 'Sign-in Method'
    },
    emailPwd: {
        id: 'user.settings.security.emailPwd',
        defaultMessage: 'Email and Password'
    },
    gitlab: {
        id: 'user.settings.security.gitlab',
        defaultMessage: 'GitLab SSO'
    }
});

class SecurityTab extends React.Component {
    constructor(props) {
        super(props);

        this.submitPassword = this.submitPassword.bind(this);
        this.updateCurrentPassword = this.updateCurrentPassword.bind(this);
        this.updateNewPassword = this.updateNewPassword.bind(this);
        this.updateConfirmPassword = this.updateConfirmPassword.bind(this);
        this.getDefaultState = this.getDefaultState.bind(this);
        this.createPasswordSection = this.createPasswordSection.bind(this);
        this.createSignInSection = this.createSignInSection.bind(this);

        this.state = this.getDefaultState();
    }
    getDefaultState() {
        return {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            authService: this.props.user.auth_service
        };
    }
    submitPassword(e) {
        e.preventDefault();

        const {formatMessage} = this.props.intl;
        var user = this.props.user;
        var currentPassword = this.state.currentPassword;
        var newPassword = this.state.newPassword;
        var confirmPassword = this.state.confirmPassword;

        if (currentPassword === '') {
            this.setState({passwordError: formatMessage(messages.currentPasswordError), serverError: ''});
            return;
        }

        if (newPassword.length < 5) {
            this.setState({passwordError: formatMessage(messages.passwordLengthError), serverError: ''});
            return;
        }

        if (newPassword !== confirmPassword) {
            this.setState({passwordError: formatMessage(messages.passwordMatchError), serverError: ''});
            return;
        }

        var data = {};
        data.user_id = user.id;
        data.current_password = currentPassword;
        data.new_password = newPassword;

        Client.updatePassword(data,
            () => {
                this.props.updateSection('');
                AsyncClient.getMe();
                this.setState(this.getDefaultState());
            },
            (err) => {
                var state = this.getDefaultState();
                if (err.message) {
                    state.serverError = err.message;
                } else {
                    state.serverError = err;
                }
                state.passwordError = '';
                this.setState(state);
            }
        );
    }
    updateCurrentPassword(e) {
        this.setState({currentPassword: e.target.value});
    }
    updateNewPassword(e) {
        this.setState({newPassword: e.target.value});
    }
    updateConfirmPassword(e) {
        this.setState({confirmPassword: e.target.value});
    }
    createPasswordSection() {
        const {formatMessage, locale} = this.props.intl;
        let updateSectionStatus;

        if (this.props.activeSection === 'password' && this.props.user.auth_service === '') {
            const inputs = [];

            inputs.push(
                <div
                    key='currentPasswordUpdateForm'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{formatMessage(messages.currentPassword)}</label>
                    <div className='col-sm-7'>
                        <input
                            className='form-control'
                            type='password'
                            onChange={this.updateCurrentPassword}
                            value={this.state.currentPassword}
                        />
                    </div>
                </div>
            );
            inputs.push(
                <div
                    key='newPasswordUpdateForm'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{formatMessage(messages.newPassword)}</label>
                    <div className='col-sm-7'>
                        <input
                            className='form-control'
                            type='password'
                            onChange={this.updateNewPassword}
                            value={this.state.newPassword}
                        />
                    </div>
                </div>
            );
            inputs.push(
                <div
                    key='retypeNewPasswordUpdateForm'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{formatMessage(messages.retypePassword)}</label>
                    <div className='col-sm-7'>
                        <input
                            className='form-control'
                            type='password'
                            onChange={this.updateConfirmPassword}
                            value={this.state.confirmPassword}
                        />
                    </div>
                </div>
            );

            updateSectionStatus = function resetSection(e) {
                this.props.updateSection('');
                this.setState({currentPassword: '', newPassword: '', confirmPassword: '', serverError: null, passwordError: null});
                e.preventDefault();
            }.bind(this);

            return (
                <SettingItemMax
                    title={formatMessage(messages.password)}
                    inputs={inputs}
                    submit={this.submitPassword}
                    server_error={this.state.serverError}
                    client_error={this.state.passwordError}
                    updateSection={updateSectionStatus}
                />
            );
        }

        var describe;
        var d = new Date(this.props.user.last_password_update);
        var dateString = d.toLocaleDateString(locale, {year:'numeric', month: 'long', day:'2-digit'});
        var timeString = d.toLocaleTimeString(locale, {hour:'2-digit', minute: '2-digit', hour12: true});
        describe = formatMessage(messages.lastUpdated) + dateString + formatMessage(messages.at) + timeString;

        updateSectionStatus = function updateSection() {
            this.props.updateSection('password');
        }.bind(this);

        return (
            <SettingItemMin
                title={formatMessage(messages.password)}
                describe={describe}
                updateSection={updateSectionStatus}
            />
        );
    }
    createSignInSection() {
        const {formatMessage} = this.props.intl;
        let updateSectionStatus;
        const user = this.props.user;

        if (this.props.activeSection === 'signin') {
            const inputs = [];
            const teamName = TeamStore.getCurrent().name;

            let emailOption;
            if (global.window.mm_config.EnableSignUpWithEmail === 'true' && user.auth_service !== '') {
                emailOption = (
                    <div>
                        <a
                            className='btn btn-primary'
                            href={'/' + teamName + '/claim?email=' + user.email}
                        >
                            {formatMessage(messages.switchEmail)}
                        </a>
                        <br/>
                    </div>
                );
            }

            let gitlabOption;
            if (global.window.mm_config.EnableSignUpWithGitLab === 'true' && user.auth_service === '') {
                gitlabOption = (
                    <div>
                        <a
                            className='btn btn-primary'
                            href={'/' + teamName + '/claim?email=' + user.email + '&new_type=' + Constants.GITLAB_SERVICE}
                        >
                            {formatMessage(messages.switchGitlab)}
                        </a>
                        <br/>
                    </div>
                );
            }

            let googleOption;
            if (global.window.mm_config.EnableSignUpWithGoogle === 'true' && user.auth_service === '') {
                googleOption = (
                    <div>
                        <a
                            className='btn btn-primary'
                            href={'/' + teamName + '/claim?email=' + user.email + '&new_type=' + Constants.GOOGLE_SERVICE}
                        >
                            {formatMessage(messages.switchGoogle)}
                        </a>
                        <br/>
                    </div>
                );
            }

            inputs.push(
                <div key='userSignInOption'>
                   {emailOption}
                   {gitlabOption}
                   <br/>
                   {googleOption}
                </div>
            );

            updateSectionStatus = function updateSection(e) {
                this.props.updateSection('');
                this.setState({serverError: null});
                e.preventDefault();
            }.bind(this);

            const extraInfo = <span>{formatMessage(messages.oneSignin)}</span>;

            return (
                <SettingItemMax
                    title={formatMessage(messages.method)}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    server_error={this.state.serverError}
                    updateSection={updateSectionStatus}
                />
            );
        }

        updateSectionStatus = function updateSection() {
            this.props.updateSection('signin');
        }.bind(this);

        let describe = formatMessage(messages.emailPwd);
        if (this.props.user.auth_service === Constants.GITLAB_SERVICE) {
            describe = formatMessage(messages.gitlab);
        }

        return (
            <SettingItemMin
                title={formatMessage(messages.method)}
                describe={describe}
                updateSection={updateSectionStatus}
            />
        );
    }
    render() {
        const {formatMessage} = this.props.intl;
        const passwordSection = this.createPasswordSection();
        let signInSection;

        let numMethods = 0;
        numMethods = global.window.mm_config.EnableSignUpWithGitLab === 'true' ? numMethods + 1 : numMethods;
        numMethods = global.window.mm_config.EnableSignUpWithGoogle === 'true' ? numMethods + 1 : numMethods;

        if (global.window.mm_config.EnableSignUpWithEmail && numMethods > 0) {
            signInSection = this.createSignInSection();
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label={formatMessage(messages.close)}
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <i
                            className='modal-back'
                            onClick={this.props.collapseModal}
                        />
                        {formatMessage(messages.title)}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{formatMessage(messages.title)}</h3>
                    <div className='divider-dark first'/>
                    {passwordSection}
                    <div className='divider-light'/>
                    {signInSection}
                    <div className='divider-dark'/>
                    <br></br>
                    <ToggleModalButton
                        className='security-links theme'
                        dialogType={AccessHistoryModal}
                    >
                        <i className='fa fa-clock-o'></i>{formatMessage(messages.viewHistory)}
                    </ToggleModalButton>
                    <b> </b>
                    <ToggleModalButton
                        className='security-links theme'
                        dialogType={ActivityLogModal}
                    >
                        <i className='fa fa-clock-o'></i>{formatMessage(messages.logoutActiveSessions)}
                    </ToggleModalButton>
                </div>
            </div>
        );
    }
}

SecurityTab.defaultProps = {
    user: {},
    activeSection: ''
};
SecurityTab.propTypes = {
    intl: intlShape.isRequired,
    user: React.PropTypes.object,
    activeSection: React.PropTypes.string,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired,
    setEnforceFocus: React.PropTypes.func.isRequired
};

export default injectIntl(SecurityTab);