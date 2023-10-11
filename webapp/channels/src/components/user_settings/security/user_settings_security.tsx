// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/* eslint-disable max-lines */

import React from 'react';
import {FormattedDate, FormattedMessage, FormattedTime} from 'react-intl';
import {Link} from 'react-router-dom';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AccessHistoryModal from 'components/access_history_modal';
import ActivityLogModal from 'components/activity_log_modal';
import ExternalLink from 'components/external_link';
import LocalizedIcon from 'components/localized_icon';
import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';
import ToggleModalButton from 'components/toggle_modal_button';

import icon50 from 'images/icon50x50.png';
import Constants from 'utils/constants';
import {t} from 'utils/i18n';
import * as Utils from 'utils/utils';

import MfaSection from './mfa_section';
import UserAccessTokenSection from './user_access_token_section';

const SECTION_MFA = 'mfa';
const SECTION_PASSWORD = 'password';
const SECTION_SIGNIN = 'signin';
const SECTION_APPS = 'apps';
const SECTION_TOKENS = 'tokens';

type Actions = {
    getMe: () => void;
    updateUserPassword: (
        userId: string,
        currentPassword: string,
        newPassword: string
    ) => Promise<ActionResult>;
    getAuthorizedOAuthApps: () => Promise<ActionResult>;
    deauthorizeOAuthApp: (clientId: string) => Promise<ActionResult>;
};

type Props = {
    user: UserProfile;
    activeSection?: string;
    updateSection: (section: string) => void;
    closeModal: () => void;
    collapseModal: () => void;
    setRequireConfirm: () => void;
    canUseAccessTokens: boolean;
    enableOAuthServiceProvider: boolean;
    enableSignUpWithEmail: boolean;
    enableSignUpWithGitLab: boolean;
    enableSignUpWithGoogle: boolean;
    enableSignUpWithOpenId: boolean;
    enableLdap: boolean;
    enableSaml: boolean;
    enableSignUpWithOffice365: boolean;
    experimentalEnableAuthenticationTransfer: boolean;
    passwordConfig: ReturnType<typeof Utils.getPasswordConfig>;
    militaryTime: boolean;
    actions: Actions;
};

type State = {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    passwordError: React.ReactNode;
    serverError: string | null;
    tokenError: string;
    savingPassword: boolean;
    authorizedApps: OAuthApp[];
};

export default class SecurityTab extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = this.getDefaultState();
    }

    getDefaultState() {
        return {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
            passwordError: '',
            serverError: '',
            tokenError: '',
            authService: this.props.user.auth_service,
            savingPassword: false,
            authorizedApps: [],
        };
    }

    componentDidMount() {
        if (this.props.enableOAuthServiceProvider) {
            this.loadAuthorizedOAuthApps();
        }
    }

    loadAuthorizedOAuthApps = async () => {
        const res = await this.props.actions.getAuthorizedOAuthApps();
        if ('data' in res) {
            const {data} = res;
            this.setState({authorizedApps: data, serverError: null});
        } else if ('error' in res) {
            const {error} = res;
            this.setState({serverError: error.message});
        }
    };

    submitPassword = async () => {
        const user = this.props.user;
        const currentPassword = this.state.currentPassword;
        const newPassword = this.state.newPassword;
        const confirmPassword = this.state.confirmPassword;

        if (currentPassword === '') {
            this.setState({
                passwordError: Utils.localizeMessage(
                    'user.settings.security.currentPasswordError',
                    'Please enter your current password.',
                ),
                serverError: '',
            });
            return;
        }

        const {valid, error} = Utils.isValidPassword(
            newPassword,
            this.props.passwordConfig,
        );
        if (!valid && error) {
            this.setState({
                passwordError: error,
                serverError: '',
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            const defaultState = Object.assign(this.getDefaultState(), {
                passwordError: Utils.localizeMessage(
                    'user.settings.security.passwordMatchError',
                    'The new passwords you entered do not match.',
                ),
                serverError: '',
            });
            this.setState(defaultState);
            return;
        }

        this.setState({savingPassword: true});

        const res = await this.props.actions.updateUserPassword(
            user.id,
            currentPassword,
            newPassword,
        );
        if ('data' in res) {
            this.props.updateSection('');
            this.props.actions.getMe();
            this.setState(this.getDefaultState());
        } else if ('error' in res) {
            const {error: err} = res;
            const state = this.getDefaultState();
            if (err.message) {
                state.serverError = err.message;
            } else {
                state.serverError = err;
            }
            state.passwordError = '';
            this.setState(state);
        }
    };

    updateCurrentPassword = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({currentPassword: e.target.value});
    };

    updateNewPassword = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({newPassword: e.target.value});
    };

    updateConfirmPassword = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({confirmPassword: e.target.value});
    };

    deauthorizeApp = async (e: React.MouseEvent) => {
        e.preventDefault();

        const appId = e.currentTarget.getAttribute('data-app') as string;

        const res = await this.props.actions.deauthorizeOAuthApp(appId);
        if ('data' in res) {
            const authorizedApps = this.state.authorizedApps.filter((app) => {
                return app.id !== appId;
            });
            this.setState({authorizedApps, serverError: null});
        } else if ('error' in res) {
            const {error} = res;
            this.setState({serverError: error.message});
        }
    };

    handleUpdateSection = (section: string) => {
        if (section) {
            this.props.updateSection(section);
        } else {
            switch (this.props.activeSection) {
            case SECTION_MFA:
            case SECTION_SIGNIN:
            case SECTION_TOKENS:
            case SECTION_APPS:
                this.setState({
                    serverError: null,
                });
                break;
            case SECTION_PASSWORD:
                this.setState({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                    serverError: null,
                    passwordError: null,
                });
                break;
            default:
            }

            this.props.updateSection('');
        }
    };

    createPasswordSection = () => {
        const inputs = [];
        let submit;

        const active = this.props.activeSection === SECTION_PASSWORD;
        let max = null;
        if (active) {
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
                                id='currentPassword'
                                autoFocus={true}
                                className='form-control'
                                type='password'
                                onChange={this.updateCurrentPassword}
                                value={this.state.currentPassword}
                                aria-label={Utils.localizeMessage(
                                    'user.settings.security.currentPassword',
                                    'Current Password',
                                )}
                            />
                        </div>
                    </div>,
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
                                id='newPassword'
                                className='form-control'
                                type='password'
                                onChange={this.updateNewPassword}
                                value={this.state.newPassword}
                                aria-label={Utils.localizeMessage(
                                    'user.settings.security.newPassword',
                                    'New Password',
                                )}
                            />
                        </div>
                    </div>,
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
                                id='confirmPassword'
                                className='form-control'
                                type='password'
                                onChange={this.updateConfirmPassword}
                                value={this.state.confirmPassword}
                                aria-label={Utils.localizeMessage(
                                    'user.settings.security.retypePassword',
                                    'Retype New Password',
                                )}
                            />
                        </div>
                    </div>,
                );
            } else if (
                this.props.user.auth_service === Constants.GITLAB_SERVICE
            ) {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='form-group'
                    >
                        <div className='pb-3'>
                            <FormattedMessage
                                id='user.settings.security.passwordGitlabCantUpdate'
                                defaultMessage='Login occurs through GitLab. Password cannot be updated.'
                            />
                        </div>
                    </div>,
                );
            } else if (
                this.props.user.auth_service === Constants.LDAP_SERVICE
            ) {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='form-group'
                    >
                        <div className='pb-3'>
                            <FormattedMessage
                                id='user.settings.security.passwordLdapCantUpdate'
                                defaultMessage='Login occurs through AD/LDAP. Password cannot be updated.'
                            />
                        </div>
                    </div>,
                );
            } else if (
                this.props.user.auth_service === Constants.SAML_SERVICE
            ) {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='form-group'
                    >
                        <div className='pb-3'>
                            <FormattedMessage
                                id='user.settings.security.passwordSamlCantUpdate'
                                defaultMessage='This field is handled through your login provider. If you want to change it, you need to do so through your login provider.'
                            />
                        </div>
                    </div>,
                );
            } else if (
                this.props.user.auth_service === Constants.GOOGLE_SERVICE
            ) {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='form-group'
                    >
                        <div className='pb-3'>
                            <FormattedMessage
                                id='user.settings.security.passwordGoogleCantUpdate'
                                defaultMessage='Login occurs through Google Apps. Password cannot be updated.'
                            />
                        </div>
                    </div>,
                );
            } else if (
                this.props.user.auth_service === Constants.OFFICE365_SERVICE
            ) {
                inputs.push(
                    <div
                        key='oauthEmailInfo'
                        className='form-group'
                    >
                        <div className='pb-3'>
                            <FormattedMessage
                                id='user.settings.security.passwordOffice365CantUpdate'
                                defaultMessage='Login occurs through Office 365. Password cannot be updated.'
                            />
                        </div>
                    </div>,
                );
            }

            max = (
                <SettingItemMax
                    title={
                        <FormattedMessage
                            id='user.settings.security.password'
                            defaultMessage='Password'
                        />
                    }
                    inputs={inputs}
                    submit={submit}
                    saving={this.state.savingPassword}
                    serverError={this.state.serverError}
                    clientError={this.state.passwordError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

        let describe;

        if (this.props.user.auth_service === '') {
            const d = new Date(this.props.user.last_password_update);

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
                                hour12={!this.props.militaryTime}
                                hour='2-digit'
                                minute='2-digit'
                            />
                        ),
                    }}
                />
            );
        } else if (this.props.user.auth_service === Constants.GITLAB_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.loginGitlab'
                    defaultMessage='Login done through GitLab'
                />
            );
        } else if (this.props.user.auth_service === Constants.LDAP_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.loginLdap'
                    defaultMessage='Login done through AD/LDAP'
                />
            );
        } else if (this.props.user.auth_service === Constants.SAML_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.loginSaml'
                    defaultMessage='Login done through SAML'
                />
            );
        } else if (this.props.user.auth_service === Constants.GOOGLE_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.loginGoogle'
                    defaultMessage='Login done through Google Apps'
                />
            );
        } else if (
            this.props.user.auth_service === Constants.OFFICE365_SERVICE
        ) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.loginOffice365'
                    defaultMessage='Login done through Office 365'
                />
            );
        }

        return (
            <SettingItem
                active={active}
                areAllSectionsInactive={this.props.activeSection === ''}
                title={
                    <FormattedMessage
                        id='user.settings.security.password'
                        defaultMessage='Password'
                    />
                }
                describe={describe}
                section={SECTION_PASSWORD}
                updateSection={this.handleUpdateSection}
                max={max}
            />
        );
    };

    createSignInSection = () => {
        const user = this.props.user;

        const active = this.props.activeSection === SECTION_SIGNIN;
        let max = null;
        if (active) {
            let emailOption;
            let gitlabOption;
            let googleOption;
            let office365Option;
            let openidOption;
            let ldapOption;
            let samlOption;

            if (user.auth_service === '') {
                if (this.props.enableSignUpWithGitLab) {
                    gitlabOption = (
                        <div className='pb-3'>
                            <Link
                                className='btn btn-primary'
                                to={
                                    '/claim/email_to_oauth?email=' +
                                    encodeURIComponent(user.email) +
                                    '&old_type=' +
                                    user.auth_service +
                                    '&new_type=' +
                                    Constants.GITLAB_SERVICE
                                }
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchGitlab'
                                    defaultMessage='Switch to Using GitLab SSO'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }

                if (this.props.enableSignUpWithGoogle) {
                    googleOption = (
                        <div className='pb-3'>
                            <Link
                                className='btn btn-primary'
                                to={
                                    '/claim/email_to_oauth?email=' +
                                    encodeURIComponent(user.email) +
                                    '&old_type=' +
                                    user.auth_service +
                                    '&new_type=' +
                                    Constants.GOOGLE_SERVICE
                                }
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchGoogle'
                                    defaultMessage='Switch to Using Google SSO'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }

                if (this.props.enableSignUpWithOffice365) {
                    office365Option = (
                        <div className='pb-3'>
                            <Link
                                className='btn btn-primary'
                                to={
                                    '/claim/email_to_oauth?email=' +
                                    encodeURIComponent(user.email) +
                                    '&old_type=' +
                                    user.auth_service +
                                    '&new_type=' +
                                    Constants.OFFICE365_SERVICE
                                }
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchOffice365'
                                    defaultMessage='Switch to Using Office 365 SSO'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }

                if (this.props.enableSignUpWithOpenId) {
                    openidOption = (
                        <div className='pb-3'>
                            <Link
                                className='btn btn-primary'
                                to={
                                    '/claim/email_to_oauth?email=' +
                                    encodeURIComponent(user.email) +
                                    '&old_type=' +
                                    user.auth_service +
                                    '&new_type=' +
                                    Constants.OPENID_SERVICE
                                }
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchOpenId'
                                    defaultMessage='Switch to Using OpenID SSO'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }

                if (this.props.enableLdap) {
                    ldapOption = (
                        <div className='pb-3'>
                            <Link
                                className='btn btn-primary'
                                to={
                                    '/claim/email_to_ldap?email=' +
                                    encodeURIComponent(user.email)
                                }
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchLdap'
                                    defaultMessage='Switch to Using AD/LDAP'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }

                if (this.props.enableSaml) {
                    samlOption = (
                        <div className='pb-3'>
                            <Link
                                className='btn btn-primary'
                                to={
                                    '/claim/email_to_oauth?email=' +
                                    encodeURIComponent(user.email) +
                                    '&old_type=' +
                                    user.auth_service +
                                    '&new_type=' +
                                    Constants.SAML_SERVICE
                                }
                            >
                                <FormattedMessage
                                    id='user.settings.security.switchSaml'
                                    defaultMessage='Switch to Using SAML SSO'
                                />
                            </Link>
                            <br/>
                        </div>
                    );
                }
            } else if (this.props.enableSignUpWithEmail) {
                let link;
                if (user.auth_service === Constants.LDAP_SERVICE) {
                    link =
                        '/claim/ldap_to_email?email=' +
                        encodeURIComponent(user.email);
                } else {
                    link =
                        '/claim/oauth_to_email?email=' +
                        encodeURIComponent(user.email) +
                        '&old_type=' +
                        user.auth_service;
                }

                emailOption = (
                    <div className='pb-3'>
                        <Link
                            className='btn btn-primary'
                            to={link}
                        >
                            <FormattedMessage
                                id='user.settings.security.switchEmail'
                                defaultMessage='Switch to Using Email and Password'
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
                    {openidOption}
                    {ldapOption}
                    {samlOption}
                </div>,
            );

            const extraInfo = (
                <span>
                    <FormattedMessage
                        id='user.settings.security.oneSignin'
                        defaultMessage='You may only have one sign-in method at a time. Switching sign-in method will send an email notifying you if the change was successful.'
                    />
                </span>
            );

            max = (
                <SettingItemMax
                    title={Utils.localizeMessage(
                        'user.settings.security.method',
                        'Sign-in Method',
                    )}
                    extraInfo={extraInfo}
                    inputs={inputs}
                    serverError={this.state.serverError}
                    updateSection={this.handleUpdateSection}
                />
            );
        }

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
        } else if (
            this.props.user.auth_service === Constants.OFFICE365_SERVICE
        ) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.office365'
                    defaultMessage='Office 365'
                />
            );
        } else if (
            this.props.user.auth_service === Constants.OPENID_SERVICE
        ) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.openid'
                    defaultMessage='OpenID'
                />
            );
        } else if (this.props.user.auth_service === Constants.LDAP_SERVICE) {
            describe = (
                <FormattedMessage
                    id='user.settings.security.ldap'
                    defaultMessage='AD/LDAP'
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
            <SettingItem
                active={active}
                areAllSectionsInactive={this.props.activeSection === ''}
                title={Utils.localizeMessage(
                    'user.settings.security.method',
                    'Sign-in Method',
                )}
                describe={describe}
                section={SECTION_SIGNIN}
                updateSection={this.handleUpdateSection}
                max={max}
            />
        );
    };

    createOAuthAppsSection = () => {
        const active = this.props.activeSection === SECTION_APPS;
        let max = null;
        if (active) {
            let apps;
            if (
                this.state.authorizedApps &&
                this.state.authorizedApps.length > 0
            ) {
                apps = this.state.authorizedApps.map((app) => {
                    const homepage = (
                        <ExternalLink
                            href={app.homepage}
                            location='user_settings_security'
                        >
                            {app.homepage}
                        </ExternalLink>
                    );

                    return (
                        <div
                            key={app.id}
                            className='pb-3 authorized-app'
                        >
                            <div className='col-sm-10'>
                                <div className='authorized-app__name'>
                                    {app.name}
                                    <span className='authorized-app__url'>
                                        {' -'} {homepage}
                                    </span>
                                </div>
                                <div className='authorized-app__description'>
                                    {app.description}
                                </div>
                                <div className='authorized-app__deauthorize'>
                                    <a
                                        href='#'
                                        data-app={app.id}
                                        onClick={this.deauthorizeApp}
                                    >
                                        <FormattedMessage
                                            id='user.settings.security.deauthorize'
                                            defaultMessage='Deauthorize'
                                        />
                                    </a>
                                </div>
                            </div>
                            <div className='col-sm-2 pull-right'>
                                <img
                                    alt={app.name}
                                    src={app.icon_url || icon50}
                                />
                            </div>
                            <br/>
                        </div>
                    );
                });
            } else {
                apps = (
                    <div className='pb-3 authorized-app'>
                        <div className='setting-list__hint'>
                            <FormattedMessage
                                id='user.settings.security.noApps'
                                defaultMessage='No OAuth 2.0 Applications are authorized.'
                            />
                        </div>
                    </div>
                );
            }

            const inputs = [];
            let wrapperClass;
            let helpText;
            if (Array.isArray(apps)) {
                wrapperClass = 'authorized-apps__wrapper';

                helpText = (
                    <div className='authorized-apps__help'>
                        <FormattedMessage
                            id='user.settings.security.oauthAppsHelp'
                            defaultMessage='Applications act on your behalf to access your data based on the permissions you grant them.'
                        />
                    </div>
                );
            }

            inputs.push(
                <div
                    className={wrapperClass}
                    key='authorizedApps'
                >
                    {apps}
                </div>,
            );

            const title = (
                <div>
                    <FormattedMessage
                        id='user.settings.security.oauthApps'
                        defaultMessage='OAuth 2.0 Applications'
                    />
                    {helpText}
                </div>
            );

            max = (
                <SettingItemMax
                    title={title}
                    inputs={inputs}
                    serverError={this.state.serverError}
                    updateSection={this.handleUpdateSection}
                    width='full'
                    cancelButtonText={
                        <FormattedMessage
                            id='user.settings.security.close'
                            defaultMessage='Close'
                        />
                    }
                />
            );
        }

        return (
            <SettingItem
                active={active}
                areAllSectionsInactive={this.props.activeSection === ''}
                title={Utils.localizeMessage(
                    'user.settings.security.oauthApps',
                    'OAuth 2.0 Applications',
                )}
                describe={
                    <FormattedMessage
                        id='user.settings.security.oauthAppsDescription'
                        defaultMessage="Click 'Edit' to manage your OAuth 2.0 Applications"
                    />
                }
                section={SECTION_APPS}
                updateSection={this.handleUpdateSection}
                max={max}
            />
        );
    };

    render() {
        const user = this.props.user;

        const passwordSection = this.createPasswordSection();

        let numMethods = 0;
        numMethods = this.props.enableSignUpWithGitLab ? numMethods + 1 : numMethods;
        numMethods = this.props.enableSignUpWithGoogle ? numMethods + 1 : numMethods;
        numMethods = this.props.enableSignUpWithOffice365 ? numMethods + 1 : numMethods;
        numMethods = this.props.enableSignUpWithOpenId ? numMethods + 1 : numMethods;
        numMethods = this.props.enableLdap ? numMethods + 1 : numMethods;
        numMethods = this.props.enableSaml ? numMethods + 1 : numMethods;

        // If there are other sign-in methods and either email is enabled or the user's account is email, then allow switching
        let signInSection;
        if (
            (this.props.enableSignUpWithEmail || user.auth_service === '') &&
            numMethods > 0 &&
            this.props.experimentalEnableAuthenticationTransfer
        ) {
            signInSection = this.createSignInSection();
        }

        let oauthSection;
        if (this.props.enableOAuthServiceProvider) {
            oauthSection = this.createOAuthAppsSection();
        }

        let tokensSection;
        if (this.props.canUseAccessTokens) {
            tokensSection = (
                <UserAccessTokenSection
                    user={this.props.user}
                    active={this.props.activeSection === SECTION_TOKENS}
                    areAllSectionsInactive={this.props.activeSection === ''}
                    updateSection={this.handleUpdateSection}
                    setRequireConfirm={this.props.setRequireConfirm}
                />
            );
        }

        return (
            <div>
                <div className='modal-header'>
                    <button
                        type='button'
                        className='close'
                        data-dismiss='modal'
                        aria-label={Utils.localizeMessage('user.settings.security.close', 'Close')}
                        onClick={this.props.closeModal}
                    >
                        <span aria-hidden='true'>{'×'}</span>
                    </button>
                    <h4
                        className='modal-title'
                    >
                        <div className='modal-back'>
                            <LocalizedIcon
                                className='fa fa-angle-left'
                                title={{id: t('generic_icons.collapse'), defaultMessage: 'Collapse Icon'}}
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
                    <MfaSection
                        active={this.props.activeSection === SECTION_MFA}
                        areAllSectionsInactive={this.props.activeSection === ''}
                        updateSection={this.handleUpdateSection}
                    />
                    <div className='divider-light'/>
                    {oauthSection}
                    <div className='divider-light'/>
                    {tokensSection}
                    <div className='divider-light'/>
                    {signInSection}
                    <div className='divider-dark'/>
                    <br/>
                    <ToggleModalButton
                        className='security-links color--link'
                        modalId='access_history'
                        dialogType={AccessHistoryModal}
                        id='viewAccessHistory'
                    >
                        <LocalizedIcon
                            className='fa fa-clock-o'
                            title={{id: t('user.settings.security.viewHistory.icon'), defaultMessage: 'Access History Icon'}}
                        />
                        <FormattedMessage
                            id='user.settings.security.viewHistory'
                            defaultMessage='View Access History'
                        />
                    </ToggleModalButton>
                    <ToggleModalButton
                        className='security-links color--link mt-2'
                        modalId='activity_log'
                        dialogType={ActivityLogModal}
                        id='viewAndLogOutOfActiveSessions'
                    >
                        <LocalizedIcon
                            className='fa fa-clock-o'
                            title={{id: t('user.settings.security.logoutActiveSessions.icon'), defaultMessage: 'Active Sessions Icon'}}
                        />
                        <FormattedMessage
                            id='user.settings.security.logoutActiveSessions'
                            defaultMessage='View and Log Out of Active Sessions'
                        />
                    </ToggleModalButton>
                </div>
            </div>
        );
    }
}
