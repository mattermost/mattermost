// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import SettingItemMin from '../setting_item_min.jsx';
import SettingItemMax from '../setting_item_max.jsx';
import AccessHistoryModal from '../access_history_modal.jsx';
import ActivityLogModal from '../activity_log_modal.jsx';
import ToggleModalButton from '../toggle_modal_button.jsx';

import PreferenceStore from 'stores/preference_store.jsx';

import Client from 'client/web_client.jsx';
import * as AsyncClient from 'utils/async_client.jsx';
import * as Utils from 'utils/utils.jsx';
import Constants from 'utils/constants.jsx';

import $ from 'jquery';
import React from 'react';
import {intlShape, injectIntl, defineMessages, FormattedMessage, FormattedHTMLMessage, FormattedTime, FormattedDate} from 'react-intl';
import {Link} from 'react-router/es6';

const holders = defineMessages({
    currentPasswordError: {
        id: 'user.settings.security.currentPasswordError',
        defaultMessage: 'Please enter your current password'
    },
    passwordLengthError: {
        id: 'user.settings.security.passwordLengthError',
        defaultMessage: 'New passwords must be at least {min} characters and at most {max} characters.'
    },
    passwordMatchError: {
        id: 'user.settings.security.passwordMatchError',
        defaultMessage: 'The new passwords you entered do not match'
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
        this.activateMfa = this.activateMfa.bind(this);
        this.deactivateMfa = this.deactivateMfa.bind(this);
        this.updateCurrentPassword = this.updateCurrentPassword.bind(this);
        this.updateNewPassword = this.updateNewPassword.bind(this);
        this.updateConfirmPassword = this.updateConfirmPassword.bind(this);
        this.updateMfaToken = this.updateMfaToken.bind(this);
        this.getDefaultState = this.getDefaultState.bind(this);
        this.createPasswordSection = this.createPasswordSection.bind(this);
        this.createSignInSection = this.createSignInSection.bind(this);
        this.showQrCode = this.showQrCode.bind(this);

        this.state = this.getDefaultState();
    }

    getDefaultState() {
        return {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            passwordError: '',
            serverError: '',
            authService: this.props.user.auth_service,
            mfaShowQr: false,
            mfaToken: ''
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

        const passwordErr = Utils.isValidPassword(newPassword);
        if (passwordErr !== '') {
            this.setState({
                passwordError: passwordErr,
                serverError: ''
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            var defaultState = Object.assign(this.getDefaultState(), {passwordError: formatMessage(holders.passwordMatchError), serverError: ''});
            this.setState(defaultState);
            return;
        }

        Client.updatePassword(
            user.id,
            currentPassword,
            newPassword,
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

    activateMfa() {
        Client.updateMfa(
            this.state.mfaToken,
            true,
            () => {
                this.props.updateSection('');
                AsyncClient.getMe();
                this.setState(this.getDefaultState());
            },
            (err) => {
                const state = this.getDefaultState();
                if (err.message) {
                    state.serverError = err.message;
                } else {
                    state.serverError = err;
                }
                state.mfaError = '';
                this.setState(state);
            }
        );
    }

    deactivateMfa() {
        Client.updateMfa(
            '',
            false,
            () => {
                this.props.updateSection('');
                AsyncClient.getMe();
                this.setState(this.getDefaultState());
            },
            (err) => {
                const state = this.getDefaultState();
                if (err.message) {
                    state.serverError = err.message;
                } else {
                    state.serverError = err;
                }
                state.mfaError = '';
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

    updateMfaToken(e) {
        this.setState({mfaToken: e.target.value});
    }

    showQrCode(e) {
        e.preventDefault();
        this.setState({mfaShowQr: true});
    }

    createMfaSection() {
        let updateSectionStatus;
        let submit;

        if (this.props.activeSection === 'mfa') {
            let content;
            let extraInfo;
            if (this.props.user.mfa_active) {
                content = (
                    <div key='mfaQrCode'>
                        <a
                            className='btn btn-primary'
                            href='#'
                            onClick={this.deactivateMfa}
                        >
                            <FormattedMessage
                                id='user.settings.mfa.remove'
                                defaultMessage='Remove MFA from your account'
                            />
                        </a>
                        <br/>
                    </div>
                );

                extraInfo = (
                    <span>
                        <FormattedMessage
                            id='user.settings.mfa.removeHelp'
                            defaultMessage='Removing multi-factor authentication will make your account more vulnerable to attacks.'
                        />
                    </span>
                );
            } else if (this.state.mfaShowQr) {
                content = (
                    <div key='mfaButton'>
                        <div className='form-group'>
                            <label className='col-sm-5 control-label'>
                                <FormattedMessage
                                    id='user.settings.mfa.qrCode'
                                    defaultMessage='Bar Code'
                                />
                            </label>
                            <div className='col-sm-7'>
                                <img
                                    className='qr-code-img'
                                    src={Client.getUsersRoute() + '/generate_mfa_qr?time=' + this.props.user.update_at}
                                />
                            </div>
                        </div>
                        <div className='form-group'>
                            <label className='col-sm-5 control-label'>
                                <FormattedMessage
                                    id='user.settings.mfa.enterToken'
                                    defaultMessage='Token (numbers only)'
                                />
                            </label>
                            <div className='col-sm-7'>
                                <input
                                    className='form-control'
                                    type='number'
                                    autoFocus={true}
                                    onChange={this.updateMfaToken}
                                    value={this.state.mfaToken}
                                />
                            </div>
                        </div>
                    </div>
                );

                extraInfo = (
                    <span>
                        <FormattedMessage
                            id='user.settings.mfa.addHelpQr'
                            defaultMessage='Please scan the QR code with the Google Authenticator app on your smartphone and fill in the token with one provided by the app.'
                        />
                    </span>
                );

                submit = this.activateMfa;
            } else {
                content = (
                    <div key='mfaQrCode'>
                        <a
                            className='btn btn-primary'
                            href='#'
                            onClick={this.showQrCode}
                        >
                            <FormattedMessage
                                id='user.settings.mfa.add'
                                defaultMessage='Add MFA to your account'
                            />
                        </a>
                        <br/>
                    </div>
                );

                extraInfo = (
                    <span>
                        <FormattedHTMLMessage
                            id='user.settings.mfa.addHelp'
                            defaultMessage="You can require a smartphone-based token, in addition to your password, to sign into Mattermost.<br/><br/>To enable, download Google Authenticator from <a target='_blank' href='https://itunes.apple.com/us/app/google-authenticator/id388497605?mt=8'>iTunes</a> or <a target='_blank' href='https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2&hl=en'>Google Play</a> for your phone, then<br/><br/>1. Click the <strong>Add MFA to your account</strong> button above.<br/>2. Use Google Authenticator to scan the QR code that appears.<br/>3. Type in the Token generated by Google Authenticator and click <strong>Save</strong>.<br/><br/>When logging in, you will be asked to enter a token from Google Authenticator in addition to your regular credentials."
                        />
                    </span>
                );
            }

            const inputs = [];
            inputs.push(
                <div
                    key='mfaSetting'
                    className='form-group'
                >
                    {content}
                </div>
            );

            updateSectionStatus = function resetSection(e) {
                this.props.updateSection('');
                this.setState({mfaToken: '', mfaShowQr: false, mfaError: null, serverError: null});
                e.preventDefault();
            }.bind(this);

            return (
                <SettingItemMax
                    title={Utils.localizeMessage('user.settings.mfa.title', 'Multi-factor Authentication')}
                    inputs={inputs}
                    extraInfo={extraInfo}
                    submit={submit}
                    server_error={this.state.serverError}
                    client_error={this.state.mfaError}
                    updateSection={updateSectionStatus}
                />
            );
        }

        let describe;
        if (this.props.user.mfa_active) {
            describe = Utils.localizeMessage('user.settings.security.active', 'Active');
        } else {
            describe = Utils.localizeMessage('user.settings.security.inactive', 'Inactive');
        }

        updateSectionStatus = function updateSection() {
            this.props.updateSection('mfa');
        }.bind(this);

        return (
            <SettingItemMin
                title={Utils.localizeMessage('user.settings.mfa.title', 'Multi-factor Authentication')}
                describe={describe}
                updateSection={updateSectionStatus}
            />
        );
    }

    createPasswordSection() {
        let updateSectionStatus;

        if (this.props.activeSection === 'password') {
            const inputs = [];
            let submit;

            if (this.props.user.auth_service === '') {
                submit = this.submitPassword;

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
            } else if (this.props.user.auth_service === Constants.GITLAB_SERVICE) {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='form-group'
                    >
                        <div className='setting-list__hint'>
                            <FormattedMessage
                                id='user.settings.security.passwordGitlabCantUpdate'
                                defaultMessage='Login occurs through GitLab. Password cannot be updated.'
                            />
                        </div>
                    </div>
                );
            } else if (this.props.user.auth_service === Constants.LDAP_SERVICE) {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='form-group'
                    >
                        <div className='setting-list__hint'>
                            <FormattedMessage
                                id='user.settings.security.passwordLdapCantUpdate'
                                defaultMessage='Login occurs through LDAP. Password cannot be updated.'
                            />
                        </div>
                    </div>
                );
            }

            updateSectionStatus = function resetSection(e) {
                this.props.updateSection('');
                this.setState({currentPassword: '', newPassword: '', confirmPassword: '', serverError: null, passwordError: null});
                e.preventDefault();
                $('.settings-modal .modal-body').scrollTop(0).perfectScrollbar('update');
            }.bind(this);

            return (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.security.password'
                            defaultMessage='Password'
                        />
                    }
                    inputs={inputs}
                    submit={submit}
                    server_error={this.state.serverError}
                    client_error={this.state.passwordError}
                    updateSection={updateSectionStatus}
                />
            );
        }

        let describe;

        if (this.props.user.auth_service === '') {
            const d = new Date(this.props.user.last_password_update);
            const hours12 = !PreferenceStore.getBool(Constants.Preferences.CATEGORY_DISPLAY_SETTINGS, Constants.Preferences.USE_MILITARY_TIME, false);

            describe = (
                <FormattedMessage
                    id='user.settings.security.lastUpdated'
                    defaultMessage='Last updated {date} at {time}'
                    values={{
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
                    }}
                />
            );
        } else if (this.props.user.auth_service === Constants.GITLAB_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.loginGitlab'
                    defaultMessage='Login done through Gitlab'
                />
            );
        } else if (this.props.user.auth_service === Constants.LDAP_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.loginLdap'
                    defaultMessage='Login done through LDAP'
                />
            );
        }

        updateSectionStatus = function updateSection() {
            this.props.updateSection('password');
        }.bind(this);

        return (
            <SettingItemMin
                title={
                    <FormattedMessage
                        id='user.settings.security.password'
                        defaultMessage='Password'
                    />
                }
                describe={describe}
                updateSection={updateSectionStatus}
            />
        );
    }

    createSignInSection() {
        let updateSectionStatus;
        const user = this.props.user;

        if (this.props.activeSection === 'signin') {
            let emailOption;
            let gitlabOption;
            let googleOption;
            let office365Option;
            let ldapOption;
            let samlOption;

            if (user.auth_service === '') {
                if (global.window.mm_config.EnableSignUpWithGitLab === 'true') {
                    gitlabOption = (
                        <div className='padding-bottom x2'>
                            <Link
                                className='btn btn-primary'
                                to={'/claim/email_to_oauth?email=' + encodeURIComponent(user.email) + '&old_type=' + user.auth_service + '&new_type=' + Constants.GITLAB_SERVICE}
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchGitlab'
                                    defaultMessage='Switch to using GitLab SSO'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }

                if (global.window.mm_config.EnableSignUpWithGoogle === 'true') {
                    googleOption = (
                        <div className='padding-bottom x2'>
                            <Link
                                className='btn btn-primary'
                                to={'/claim/email_to_oauth?email=' + encodeURIComponent(user.email) + '&old_type=' + user.auth_service + '&new_type=' + Constants.GOOGLE_SERVICE}
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchGoogle'
                                    defaultMessage='Switch to using Google SSO'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }

                if (global.window.mm_config.EnableSignUpWithOffice365 === 'true') {
                    office365Option = (
                        <div className='padding-bottom x2'>
                            <Link
                                className='btn btn-primary'
                                to={'/claim/email_to_oauth?email=' + encodeURIComponent(user.email) + '&old_type=' + user.auth_service + '&new_type=' + Constants.OFFICE365_SERVICE}
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchOffice365'
                                    defaultMessage='Switch to using Office 365 SSO'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }

                if (global.window.mm_config.EnableLdap === 'true') {
                    ldapOption = (
                        <div className='padding-bottom x2'>
                            <Link
                                className='btn btn-primary'
                                to={'/claim/email_to_ldap?email=' + encodeURIComponent(user.email)}
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchLdap'
                                    defaultMessage='Switch to using LDAP'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }

                if (global.window.mm_config.EnableSaml === 'true') {
                    samlOption = (
                        <div className='padding-bottom x2'>
                            <Link
                                className='btn btn-primary'
                                to={'/claim/email_to_oauth?email=' + encodeURIComponent(user.email) + '&old_type=' + user.auth_service + '&new_type=' + Constants.SAML_SERVICE}
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchSaml'
                                    defaultMessage='Switch to using SAML SSO'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }
            } else if (global.window.mm_config.EnableSignUpWithEmail === 'true') {
                let link;
                if (user.auth_service === Constants.LDAP_SERVICE) {
                    link = '/claim/ldap_to_email?email=' + encodeURIComponent(user.email);
                } else {
                    link = '/claim/oauth_to_email?email=' + encodeURIComponent(user.email) + '&old_type=' + user.auth_service;
                }

                emailOption = (
                    <div className='padding-bottom x2'>
                        <Link
                            className='btn btn-primary'
                            to={link}
                        >
                            <FormattedMessage
                                id='user.settings.security.switchEmail'
                                defaultMessage='Switch to using email and password'
                            />
                        </Link>
                        <br/>
                    </div>
                );
            }

            const inputs = [];
            inputs.push(
                <div key='userSignInOption'>
                    {emailOption}
                    {gitlabOption}
                    {googleOption}
                    {office365Option}
                    {ldapOption}
                    {samlOption}
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
                    defaultMessage='GitLab'
                />
            );
        } else if (this.props.user.auth_service === Constants.GOOGLE_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.google'
                    defaultMessage='Google'
                />
            );
        } else if (this.props.user.auth_service === Constants.OFFICE365_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.office365'
                    defaultMessage='Office 365'
                />
            );
        } else if (this.props.user.auth_service === Constants.LDAP_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.ldap'
                    defaultMessage='LDAP'
                />
            );
        } else if (this.props.user.auth_service === Constants.SAML_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.saml'
                    defaultMessage='SAML'
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
        const user = this.props.user;

        const passwordSection = this.createPasswordSection();

        let numMethods = 0;
        numMethods = global.window.mm_config.EnableSignUpWithGitLab === 'true' ? numMethods + 1 : numMethods;
        numMethods = global.window.mm_config.EnableSignUpWithGoogle === 'true' ? numMethods + 1 : numMethods;
        numMethods = global.window.mm_config.EnableLdap === 'true' ? numMethods + 1 : numMethods;
        numMethods = global.window.mm_config.EnableSaml === 'true' ? numMethods + 1 : numMethods;

        let signInSection;
        if (global.window.mm_config.EnableSignUpWithEmail === 'true' && numMethods > 0) {
            signInSection = this.createSignInSection();
        }

        let mfaSection;
        if (global.window.mm_config.EnableMultifactorAuthentication === 'true' &&
                global.window.mm_license.IsLicensed === 'true' &&
                (user.auth_service === '' || user.auth_service === Constants.LDAP_SERVICE)) {
            mfaSection = this.createMfaSection();
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
                    {mfaSection}
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
