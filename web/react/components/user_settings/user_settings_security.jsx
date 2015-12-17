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
import Constants from '../../utils/constants.jsx';

export default class SecurityTab extends React.Component {
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

        if (currentPassword === '') {
            this.setState({passwordError: 'Please enter your current password', serverError: ''});
            return;
        }

        if (newPassword.length < 5) {
            this.setState({passwordError: 'New passwords must be at least 5 characters', serverError: ''});
            return;
        }

        if (newPassword !== confirmPassword) {
            this.setState({passwordError: 'The new passwords you entered do not match', serverError: ''});
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

        if (this.props.activeSection === 'password' && this.props.user.auth_service === '') {
            const inputs = [];

            inputs.push(
                <div
                    key='currentPasswordUpdateForm'
                    className='form-group'
                >
                    <label className='col-sm-5 control-label'>{'Current Password'}</label>
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
                    <label className='col-sm-5 control-label'>{'New Password'}</label>
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
                    <label className='col-sm-5 control-label'>{'Retype New Password'}</label>
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
                    title='Password'
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
        var hour = '12';
        if (d.getHours() % 12) {
            hour = String(d.getHours() % 12);
        }
        var min = String(d.getMinutes());
        if (d.getMinutes() < 10) {
            min = '0' + d.getMinutes();
        }
        var timeOfDay = ' am';
        if (d.getHours() >= 12) {
            timeOfDay = ' pm';
        }

        describe = 'Last updated ' + Constants.MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' at ' + hour + ':' + min + timeOfDay;

        updateSectionStatus = function updateSection() {
            this.props.updateSection('password');
        }.bind(this);

        return (
            <SettingItemMin
                title='Password'
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
                            href={'/' + teamName + '/claim?email=' + user.email}
                        >
                            {'Switch to using email and password'}
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
                            {'Switch to using GitLab SSO'}
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
                            {'Switch to using Google SSO'}
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

            const extraInfo = <span>{'You may only have one sign-in method at a time. Switching sign-in method will send an email notifying you if the change was successful.'}</span>;

            return (
                <SettingItemMax
                    title='Sign-in Method'
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

        let describe = 'Email and Password';
        if (this.props.user.auth_service === Constants.GITLAB_SERVICE) {
            describe = 'GitLab SSO';
        }

        return (
            <SettingItemMin
                title='Sign-in Method'
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
                        aria-label='Close'
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
                        {'Security Settings'}
                    </h4>
                </div>
                <div className='user-settings'>
                    <h3 className='tab-header'>{'Security Settings'}</h3>
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
                        <i className='fa fa-clock-o'></i>View Access History
                    </ToggleModalButton>
                    <b> </b>
                    <ToggleModalButton
                        className='security-links theme'
                        dialogType={ActivityLogModal}
                    >
                        <i className='fa fa-clock-o'></i>{'View and Logout of Active Sessions'}
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
    user: React.PropTypes.object,
    activeSection: React.PropTypes.string,
    updateSection: React.PropTypes.func,
    updateTab: React.PropTypes.func,
    closeModal: React.PropTypes.func.isRequired,
    collapseModal: React.PropTypes.func.isRequired,
    setEnforceFocus: React.PropTypes.func.isRequired
};
