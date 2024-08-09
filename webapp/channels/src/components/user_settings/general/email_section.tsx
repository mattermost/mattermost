// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import {isEmail} from 'mattermost-redux/utils/helpers';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import SettingItem from 'components/setting_item';
import SettingItemMax from 'components/setting_item_max';

import {Constants} from 'utils/constants';

import {holders} from './messages';

type Props = {
    activeSection: string;
    requireEmailVerification: boolean;
    user: UserProfile;
    originalEmail: string;
    setEmail: (value: string) => void;
    email: string;
    setConfirmEmail: (value: string) => void;
    confirmEmail: string;
    setCurrentPassword: (value: string) => void;
    currentPassword: string;
    updateSection: (section: string) => void;
    serverError: string;
    emailError: string;
    sectionIsSaving: boolean;
    submitUser: (user: UserProfile, emailUpdated: boolean) => void;
    setEmailError: (error: string) => void;
    setClientError: (error: string) => void;
    setServerError: (error: string) => void;
}
const EmailSection = ({
    activeSection,
    requireEmailVerification,
    user,
    originalEmail,
    setEmail,
    email,
    confirmEmail,
    setConfirmEmail,
    currentPassword,
    setCurrentPassword,
    updateSection,
    emailError,
    serverError,
    sectionIsSaving,
    submitUser,
    setClientError,
    setEmailError,
    setServerError,
}: Props) => {
    const {formatMessage} = useIntl();

    const submitEmail = useCallback(() => {
        const patchedUser = Object.assign({}, user);
        const patchedEmail = email.trim().toLowerCase();
        const patchedConfirmEmail = confirmEmail.trim().toLowerCase();

        if (patchedEmail === patchedUser.email && (patchedConfirmEmail === '' || patchedConfirmEmail === patchedUser.email)) {
            updateSection('');
            return;
        }

        if (patchedEmail === '' || !isEmail(patchedEmail)) {
            setEmailError(formatMessage(holders.validEmail));
            setClientError('');
            setServerError('');
            return;
        }

        if (patchedEmail !== patchedConfirmEmail) {
            setEmailError(formatMessage(holders.emailMatch));
            setClientError('');
            setServerError('');
            return;
        }

        if (currentPassword === '') {
            setEmailError(formatMessage(holders.emptyPassword));
            setClientError('');
            setServerError('');
            return;
        }

        patchedUser.email = patchedEmail;
        patchedUser.password = currentPassword;
        trackEvent('settings', 'user_settings_update', {field: 'email'});
        submitUser(patchedUser, true);
    }, [
        confirmEmail,
        currentPassword,
        email,
        formatMessage,
        setClientError,
        setEmailError,
        setServerError,
        submitUser,
        updateSection,
        user,
    ]);

    const updateEmail = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(e.target.value);
    }, [setEmail]);

    const updateConfirmEmail = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setConfirmEmail(e.target.value);
    }, [setConfirmEmail]);

    const updateCurrentPassword = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentPassword(e.target.value);
    }, [setCurrentPassword]);

    const active = activeSection === 'email';
    let max = null;
    if (active) {
        const emailVerificationEnabled = requireEmailVerification;
        const inputs = [];

        let helpText = (
            <FormattedMessage
                id='user.settings.general.emailHelp1'
                defaultMessage='Email is used for sign-in, notifications, and password reset. Email requires verification if changed.'
            />
        );

        if (!emailVerificationEnabled) {
            helpText = (
                <FormattedMessage
                    id='user.settings.general.emailHelp3'
                    defaultMessage='Email is used for sign-in, notifications, and password reset.'
                />
            );
        }

        let submit = null;

        if (user.auth_service === '') {
            inputs.push(
                <div key='currentEmailSetting'>
                    <div className='form-group'>
                        <label className='col-sm-5 control-label'>
                            <FormattedMessage
                                id='user.settings.general.currentEmail'
                                defaultMessage='Current Email'
                            />
                        </label>
                        <div className='col-sm-7'>
                            <label className='control-label word-break--all text-left'>{originalEmail}</label>
                        </div>
                    </div>
                </div>,
            );

            inputs.push(
                <div key='emailSetting'>
                    <div className='form-group'>
                        <label className='col-sm-5 control-label'>
                            <FormattedMessage
                                id='user.settings.general.newEmail'
                                defaultMessage='New Email'
                            />
                        </label>
                        <div className='col-sm-7'>
                            <input
                                autoFocus={true}
                                id='primaryEmail'
                                className='form-control'
                                type='email'
                                onChange={updateEmail}
                                maxLength={Constants.MAX_EMAIL_LENGTH}
                                value={email}
                                aria-label={formatMessage({id: 'user.settings.general.newEmail', defaultMessage: 'New Email'})}
                            />
                        </div>
                    </div>
                </div>,
            );

            inputs.push(
                <div key='confirmEmailSetting'>
                    <div className='form-group'>
                        <label className='col-sm-5 control-label'>
                            <FormattedMessage
                                id='user.settings.general.confirmEmail'
                                defaultMessage='Confirm Email'
                            />
                        </label>
                        <div className='col-sm-7'>
                            <input
                                id='confirmEmail'
                                className='form-control'
                                type='email'
                                onChange={updateConfirmEmail}
                                maxLength={Constants.MAX_EMAIL_LENGTH}
                                value={confirmEmail}
                                aria-label={formatMessage({id: 'user.settings.general.confirmEmail', defaultMessage: 'Confirm Email'})}
                            />
                        </div>
                    </div>
                </div>,
            );

            inputs.push(
                <div key='currentPassword'>
                    <div className='form-group'>
                        <label className='col-sm-5 control-label'>
                            <FormattedMessage
                                id='user.settings.general.currentPassword'
                                defaultMessage='Current Password'
                            />
                        </label>
                        <div className='col-sm-7'>
                            <input
                                id='currentPassword'
                                className='form-control'
                                type='password'
                                onChange={updateCurrentPassword}
                                value={currentPassword}
                                aria-label={formatMessage({id: 'user.settings.general.currentPassword', defaultMessage: 'Current Password'})}
                            />
                        </div>
                    </div>
                    {helpText}
                </div>,
            );

            submit = submitEmail;
        } else if (user.auth_service === Constants.GITLAB_SERVICE) {
            inputs.push(
                <div
                    key='oauthEmailInfo'
                    className='form-group'
                >
                    <div className='setting-list__hint pb-3'>
                        <FormattedMessage
                            id='user.settings.general.emailGitlabCantUpdate'
                            defaultMessage='Login occurs through GitLab. Email cannot be updated. Email address used for notifications is {email}.'
                            values={{
                                email: originalEmail,
                            }}
                        />
                    </div>
                    {helpText}
                </div>,
            );
        } else if (user.auth_service === Constants.GOOGLE_SERVICE) {
            inputs.push(
                <div
                    key='oauthEmailInfo'
                    className='form-group'
                >
                    <div className='setting-list__hint pb-3'>
                        <FormattedMessage
                            id='user.settings.general.emailGoogleCantUpdate'
                            defaultMessage='Login occurs through Google Apps. Email cannot be updated. Email address used for notifications is {email}.'
                            values={{
                                email: originalEmail,
                            }}
                        />
                    </div>
                    {helpText}
                </div>,
            );
        } else if (user.auth_service === Constants.OFFICE365_SERVICE) {
            inputs.push(
                <div
                    key='oauthEmailInfo'
                    className='form-group'
                >
                    <div className='setting-list__hint pb-3'>
                        <FormattedMessage
                            id='user.settings.general.emailOffice365CantUpdate'
                            defaultMessage='Login occurs through Office 365. Email cannot be updated. Email address used for notifications is {email}.'
                            values={{
                                email: originalEmail,
                            }}
                        />
                    </div>
                    {helpText}
                </div>,
            );
        } else if (user.auth_service === Constants.OPENID_SERVICE) {
            inputs.push(
                <div
                    key='oauthEmailInfo'
                    className='form-group'
                >
                    <div className='setting-list__hint pb-3'>
                        <FormattedMessage
                            id='user.settings.general.emailOpenIdCantUpdate'
                            defaultMessage='Login occurs through OpenID Connect. Email cannot be updated. Email address used for notifications is {email}.'
                            values={{
                                email: originalEmail,
                            }}
                        />
                    </div>
                    {helpText}
                </div>,
            );
        } else if (user.auth_service === Constants.LDAP_SERVICE) {
            inputs.push(
                <div
                    key='oauthEmailInfo'
                    className='pb-2'
                >
                    <div className='setting-list__hint pb-3'>
                        <FormattedMessage
                            id='user.settings.general.emailLdapCantUpdate'
                            defaultMessage='Login occurs through AD/LDAP. Email cannot be updated. Email address used for notifications is {email}.'
                            values={{
                                email: originalEmail,
                            }}
                        />
                    </div>
                </div>,
            );
        } else if (user.auth_service === Constants.SAML_SERVICE) {
            inputs.push(
                <div
                    key='oauthEmailInfo'
                    className='pb-2'
                >
                    <div className='setting-list__hint pb-3'>
                        <FormattedMessage
                            id='user.settings.general.emailSamlCantUpdate'
                            defaultMessage='Login occurs through SAML. Email cannot be updated. Email address used for notifications is {email}.'
                            values={{
                                email: originalEmail,
                            }}
                        />
                    </div>
                    {helpText}
                </div>,
            );
        }

        max = (
            <SettingItemMax
                title={
                    <FormattedMessage
                        id='user.settings.general.email'
                        defaultMessage='Email'
                    />
                }
                inputs={inputs}
                submit={submit}
                saving={sectionIsSaving}
                serverError={serverError}
                clientError={emailError}
                updateSection={updateSection}
            />
        );
    }

    let describe: JSX.Element|string = '';
    if (user.auth_service === '') {
        describe = user.email;
    } else if (user.auth_service === Constants.GITLAB_SERVICE) {
        describe = (
            <FormattedMessage
                id='user.settings.general.loginGitlab'
                defaultMessage='Login done through GitLab ({email})'
                values={{
                    email: originalEmail,
                }}
            />
        );
    } else if (user.auth_service === Constants.GOOGLE_SERVICE) {
        describe = (
            <FormattedMessage
                id='user.settings.general.loginGoogle'
                defaultMessage='Login done through Google Apps ({email})'
                values={{
                    email: originalEmail,
                }}
            />
        );
    } else if (user.auth_service === Constants.OFFICE365_SERVICE) {
        describe = (
            <FormattedMessage
                id='user.settings.general.loginOffice365'
                defaultMessage='Login done through Office 365 ({email})'
                values={{
                    email: originalEmail,
                }}
            />
        );
    } else if (user.auth_service === Constants.LDAP_SERVICE) {
        describe = (
            <FormattedMessage
                id='user.settings.general.loginLdap'
                defaultMessage='Login done through AD/LDAP ({email})'
                values={{
                    email: originalEmail,
                }}
            />
        );
    } else if (user.auth_service === Constants.SAML_SERVICE) {
        describe = (
            <FormattedMessage
                id='user.settings.general.loginSaml'
                defaultMessage='Login done through SAML ({email})'
                values={{
                    email: originalEmail,
                }}
            />
        );
    }

    return (
        <SettingItem
            active={active}
            areAllSectionsInactive={activeSection === ''}
            title={
                <FormattedMessage
                    id='user.settings.general.email'
                    defaultMessage='Email'
                />
            }
            describe={describe}
            section={'email'}
            updateSection={updateSection}
            max={max}
        />
    );
};

export default EmailSection;
