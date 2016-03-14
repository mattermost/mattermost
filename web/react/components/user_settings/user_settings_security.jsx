// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import AccessHistoryModal from '../access_history_modal.jsx';
import ActivityLogModal from '../activity_log_modal.jsx';
import ToggleModalButton from '../toggle_modal_button.jsx';

import TeamStore from '../../stores/team_store.jsx';

import * as Client from '../../utils/client.jsx';
import * as AsyncClient from '../../utils/async_client.jsx';
import * as Utils from '../../utils/utils.jsx';
import Constants from '../../utils/constants.jsx';

import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedTime, FormattedDate} from 'mm-intl';

const holders = defineMessages({
    currentPasswordError: {
        id: 'user.settings.security.currentPasswordError',
        defaultMessage: 'Please enter your current password'
    },
    passwordLengthError: {
        id: 'user.settings.security.passwordLengthError',
        defaultMessage: 'New passwords must be at least {chars} characters'
    },
    passwordMatchError: {
        id: 'user.settings.security.passwordMatchError',
        defaultMessage: 'The new passwords you entered do not match'
    },
    password: {
        id: 'user.settings.security.password',
        defaultMessage: 'Password'
    },
    lastUpdated: {
        id: 'user.settings.security.lastUpdated',
        defaultMessage: 'Last updated {date} at {time}'
    },
    method: {
        id: 'user.settings.security.method',
        defaultMessage: 'Sign-in Method'
    },
    close: {
        id: 'user.settings.security.close',
        defaultMessage: 'Close'
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

        var user = this.props.user;
        var currentPassword = this.state.currentPassword;
        var newPassword = this.state.newPassword;
        var confirmPassword = this.state.confirmPassword;

        const {formatMessage} = this.props.intl;
        if (currentPassword === '') {
            this.setState({passwordError: formatMessage(holders.currentPasswordError), serverError: ''});
            return;
        }

        if (newPassword.length < Constants.MIN_PASSWORD_LENGTH) {
            this.setState({passwordError: formatMessage(holders.passwordLengthError, {chars: Constants.MIN_PASSWORD_LENGTH}), serverError: ''});
            return;
        }

        if (newPassword !== confirmPassword) {
            var defaultState = Object.assign(this.getDefaultState(), {passwordError: formatMessage(holders.passwordMatchError), serverError: ''});
            this.setState(defaultState);
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
        let updateSectionStatus;
        const {formatMessage} = this.props.intl;

        if (this.props.activeSection === 'password' && this.props.user.auth_service === '') {
            const inputs = [];

            inputs.push(
                <div
                    key='currentPasswordUpdateForm'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>
                        <FormattedMessage
                            id='user.settings.security.currentPassword'
                            defaultMessage='Current Password'
                        />
                    </label>
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
                    <label className='col-sm-5 control-label'>
                        <FormattedMessage
                            id='user.settings.security.newPassword'
                            defaultMessage='New Password'
                        />
                    </label>
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
                    <label className='col-sm-5 control-label'>
                        <FormattedMessage
                            id='user.settings.security.retypePassword'
                            defaultMessage='Retype New Password'
                        />
                    </label>
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
                    title={formatMessage(holders.password)}
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

        const hours12 = !Utils.isMilitaryTime();
        describe = formatMessage(holders.lastUpdated, {
            date: (
                <FormattedDate
                    value={d}
                    day='2-digit'
                    month='short'
                    year='numeric'
                />
            ),
            time: (
                <FormattedTime
                    value={d}
                    hour12={hours12}
                    hour='2-digit'
                    minute='2-digit'
                />
            )
        });

        updateSectionStatus = function updateSection() {
            this.props.updateSection('password');
        }.bind(this);

        return (
            <SettingItemMin
                title={formatMessage(holders.password)}
                describe={describe}
                updateSection={updateSectionStatus}
            />
        );
    }
    createSignInSection() {
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
                            href={'/' + teamName + '/claim?email=' + encodeURIComponent(user.email) + '&old_type=' + user.auth_service}
                        >
                            <FormattedMessage
                                id='user.settings.security.switchEmail'
                                defaultMessage='Switch to using email and password'
                            />
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
                            href={'/' + teamName + '/claim?email=' + encodeURIComponent(user.email) + '&old_type=' + user.auth_service + '&new_type=' + Constants.GITLAB_SERVICE}
                        >
                            <FormattedMessage
                                id='user.settings.security.switchGitlab'
                                defaultMessage='Switch to using GitLab SSO'
                            />
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
                            href={'/' + teamName + '/claim?email=' + encodeURIComponent(user.email) + '&old_type=' + user.auth_service + '&new_type=' + Constants.GOOGLE_SERVICE}
                        >
                            <FormattedMessage
                                id='user.settings.security.switchGoogle'
                                defaultMessage='Switch to using Google SSO'
                            />
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

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.security.oneSignin'
                        defaultMessage='You may only have one sign-in method at a time. Switching sign-in method will send an email notifying you if the change was successful.'
                    />
                </span>
            );

            return (
                <SettingItemMax
                    title={this.props.intl.formatMessage(holders.method)}
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

        let describe = (
            <FormattedMessage
                id='user.settings.security.emailPwd'
                defaultMessage='Email and Password'
            />
        );
        if (this.props.user.auth_service === Constants.GITLAB_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.gitlab'
                    defaultMessage='GitLab SSO'
                />
            );
        }

        return (
            <SettingItemMin
                title={this.props.intl.formatMessage(holders.method)}
                describe={describe}
                updateSection={updateSectionStatus}
            />
        );
    }
    render() {
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
                        aria-label={this.props.intl.formatMessage(holders.close)}
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                        ref='title'
                    >
                        <div className='modal-back'>
                            <i
                                className='fa fa-angle-left'
                                onClick={this.props.collapseModal}
                            />
                        </div>
                        <FormattedMessage
                            id='user.settings.security.title'
                            defaultMessage='Security Settings'
                        />
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>
                        <FormattedMessage
                            id='user.settings.security.title'
                            defaultMessage='Security Settings'
                        />
                    </h3>
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
                        <i className='fa fa-clock-o'></i>
                        <FormattedMessage
                            id='user.settings.security.viewHistory'
                            defaultMessage='View Access History'
                        />
                    </ToggleModalButton>
                    <b> </b>
                    <ToggleModalButton
                        className='security-links theme'
                        dialogType={ActivityLogModal}
                    >
                        <i className='fa fa-clock-o'></i>
                        <FormattedMessage
                            id='user.settings.security.logoutActiveSessions'
                            defaultMessage='View and Logout of Active Sessions'
                        />
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
