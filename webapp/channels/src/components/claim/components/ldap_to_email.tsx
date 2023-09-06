// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AuthChangeResponse} from '@mattermost/types/users';

import LocalizedInput from 'components/localized_input/localized_input';
import LoginMfa from 'components/login/login_mfa';

import {ClaimErrors} from 'utils/constants';
import {t} from 'utils/i18n';
import {isValidPassword, localizeMessage} from 'utils/utils';

import type {SubmitOptions} from './email_to_ldap';
import ErrorLabel from './error_label';

import type {PasswordConfig} from '../claim_controller';

type Props = {
    email: string | null;
    switchLdapToEmail: (ldapPassword: string, email: string, password: string, token: string) => Promise<{data?: AuthChangeResponse; error?: {server_error_id: string; message: string}}>;
    passwordConfig?: PasswordConfig;
}

const LDAPToEmail = (props: Props) => {
    const [passwordError, setPasswordError] = useState<string | JSX.Element>('');
    const [confirmError, setConfirmError] = useState('');
    const [ldapPasswordError, setLdapPasswordError] = useState('');
    const [serverError, setServerError] = useState('');
    const [password, setPassword] = useState('');
    const [ldapPassword, setLdapPassword] = useState('');
    const [showMfa, setShowMfa] = useState(true);

    const ldapPasswordInput = useRef<HTMLInputElement>(null);
    const passwordInput = useRef<HTMLInputElement>(null);
    const passwordConfirmInput = useRef<HTMLInputElement>(null);

    const preSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const ldapPassword = ldapPasswordInput.current?.value;
        if (!ldapPassword) {
            setLdapPasswordError(localizeMessage('claim.ldap_to_email.ldapPasswordError', 'Please enter your AD/LDAP password.'));
            setPasswordError('');
            setConfirmError('');
            setServerError('');
            return;
        }

        const password = passwordInput.current?.value;
        if (!password) {
            setPasswordError(localizeMessage('claim.ldap_to_email.pwdError', 'Please enter your password.'));
            setConfirmError('');
            setLdapPasswordError('');
            setServerError('');
            return;
        }

        if (props.passwordConfig) {
            const {valid, error} = isValidPassword(password, props.passwordConfig);
            if (!valid && error) {
                setPasswordError(error);
                setConfirmError('');
                setLdapPasswordError('');
                setServerError('');
                return;
            }
        }

        const confirmPassword = passwordConfirmInput.current?.value;
        if (!confirmPassword || password !== confirmPassword) {
            setConfirmError(localizeMessage('claim.ldap_to_email.pwdNotMatch', 'Passwords do not match.'));
            setPasswordError('');
            setLdapPasswordError('');
            setServerError('');
            return;
        }

        setPassword(password);
        setLdapPassword(ldapPassword);

        if (props.email) {
            submit({loginId: props.email, password, ldapPasswordParam: ldapPassword});
        }
    };

    const submit = ({loginId, password, token = '', ldapPasswordParam}: SubmitOptions) => {
        props.switchLdapToEmail(ldapPasswordParam || ldapPassword, loginId, password, token).then(({data, error: err}) => {
            if (data?.follow_link) {
                window.location.href = data.follow_link;
            } else if (err) {
                if (err.server_error_id.startsWith('model.user.is_valid.pwd')) {
                    setPasswordError(err.message);
                    setShowMfa(false);
                } else if (err.server_error_id === ClaimErrors.ENT_LDAP_LOGIN_INVALID_PASSWORD) {
                    setLdapPasswordError(err.message);
                    setShowMfa(false);
                } else if (!showMfa && err.server_error_id === ClaimErrors.MFA_VALIDATE_TOKEN_AUTHENTICATE) {
                    setShowMfa(true);
                } else {
                    setServerError(err.message);
                    setShowMfa(false);
                }
            }
        });
    };

    const passwordPlaceholder = localizeMessage('claim.ldap_to_email.ldapPwd', 'AD/LDAP Password');
    const titleMessage = {id: t('claim.ldap_to_email.title'), defaultMessage: 'Switch AD/LDAP Account to Email/Password'};
    const placeholderPasswordMessage = {id: t('claim.ldap_to_email.pwd'), defaultMessage: 'Password'};
    const placeholderConfirmMessage = {id: t('claim.ldap_to_email.confirm'), defaultMessage: 'Confirm Password'};

    if (showMfa) {
        return (
            <LoginMfa
                loginId={props.email}
                password={password}
                title={titleMessage}
                onSubmit={submit}
            />
        );
    }
    return (
        <>
            <h3>
                <FormattedMessage
                    id='claim.ldap_to_email.title'
                    defaultMessage='Switch AD/LDAP Account to Email/Password'
                />
            </h3>
            <form
                onSubmit={preSubmit}
                className={classNames('form-group', {'has-error': serverError})}
            >
                <p>
                    <FormattedMessage
                        id='claim.ldap_to_email.email'
                        defaultMessage='After switching your authentication method, you will use {email} to login. Your AD/LDAP credentials will no longer allow access to Mattermost.'
                        values={{email: props.email}}
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='claim.ldap_to_email.enterLdapPwd'
                        defaultMessage='{ldapPassword}:'
                        values={{ldapPassword: passwordPlaceholder}}
                    />
                </p>
                <div className={classNames('form-group', {'has-error': ldapPasswordError})}>
                    <input
                        type='password'
                        className='form-control'
                        name='ldapPassword'
                        ref={ldapPasswordInput}
                        placeholder={passwordPlaceholder}
                        spellCheck='false'
                    />
                </div>
                <ErrorLabel errorText={ldapPasswordError}/>
                <p>
                    <FormattedMessage
                        id='claim.ldap_to_email.enterPwd'
                        defaultMessage='New email login password:'
                    />
                </p>
                <div className={classNames('form-group', {'has-error': passwordError})}>
                    <LocalizedInput
                        type='password'
                        className='form-control'
                        name='password'
                        ref={passwordInput}
                        placeholder={placeholderPasswordMessage}
                        spellCheck='false'
                    />
                </div>
                <ErrorLabel errorText={passwordError}/>
                <div className={classNames('form-group', {'has-error': confirmError})}>
                    <LocalizedInput
                        type='password'
                        className='form-control'
                        name='passwordconfirm'
                        ref={passwordConfirmInput}
                        placeholder={placeholderConfirmMessage}
                        spellCheck='false'
                    />
                </div>
                <ErrorLabel errorText={confirmError}/>
                <button
                    type='submit'
                    className='btn btn-primary'
                >
                    <FormattedMessage
                        id='claim.ldap_to_email.switchTo'
                        defaultMessage='Switch account to email/password'
                    />
                </button>
                <ErrorLabel errorText={serverError}/>
            </form>
        </>
    );
};

export default LDAPToEmail;
