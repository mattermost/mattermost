// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {FormattedMessage} from 'react-intl';
import React, {FormEvent, useCallback, useState} from 'react';

import classNames from 'classnames';

import {localizeMessage, toTitleCase} from 'utils/utils';
import Constants, {ClaimErrors} from 'utils/constants';

import LoginMfa from 'components/login/login_mfa';
import {t} from 'utils/i18n';

import {AuthChangeResponse} from '@mattermost/types/users';

import ErrorLabel from './error_label';
import {SubmitOptions} from './email_to_ldap';

type Props = {
    email: string | null;
    newType: string | null;
    siteName?: string;

    switchLdapToOAuth: (service: string, ldapPassword: string, email: string, mfaToken: string) => Promise<{ data?: AuthChangeResponse; error?: { server_error_id: string; message: string } }>;
}

export default function LDAPToOAuth({switchLdapToOAuth, ...props}: Props) {
    const [ldapPassword, setLdapPassword] = useState('');
    const [ldapPasswordError, setLdapPasswordError] = useState('');
    const [showMfa, setShowMfa] = useState(false);
    const [serverError, setServerError] = useState('');

    const email = props.email || '';
    const newType = props.newType || '';

    const mfaTitleMessage = {id: t('claim.ldap_to_oauth.title'), defaultMessage: 'Switch AD/LDAP Account to {type} SSO'};
    const placeholderLDAPPassword = localizeMessage('claim.ldap_to_oauth.ldapPwd', 'AD/LDAP Password');
    const formattedType = (props.newType === Constants.SAML_SERVICE ? Constants.SAML_SERVICE.toUpperCase() : toTitleCase(props.newType || ''));

    const onSubmit = useCallback(async ({loginId, password, token = ''}: SubmitOptions) => {
        const {data, error} = await switchLdapToOAuth(newType.toLowerCase(), password, loginId, token);
        if (data?.follow_link) {
            window.location.href = data.follow_link;
            return;
        }

        if (!error) {
            return;
        }

        if (error.server_error_id === ClaimErrors.ENT_LDAP_LOGIN_INVALID_PASSWORD) {
            setLdapPasswordError(error.message);
            setShowMfa(false);
        } else if (!showMfa && error.server_error_id === ClaimErrors.MFA_VALIDATE_TOKEN_AUTHENTICATE) {
            setShowMfa(true);
        } else {
            setServerError(error.message);
            setShowMfa(false);
        }
    }, [newType, setShowMfa, showMfa, switchLdapToOAuth]);

    const handleFormSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();

        setLdapPasswordError('');
        if (ldapPassword === '') {
            setLdapPasswordError(localizeMessage('claim.ldap_to_oauth.ldapPasswordError', 'Please enter your AD/LDAP password.'));
            return;
        }

        onSubmit({loginId: email, password: ldapPassword});
    }, [email, ldapPassword, onSubmit]);

    if (email === '' || newType === '') {
        return null;
    }

    if (showMfa) {
        return (
            <LoginMfa
                loginId={props.email}
                password={ldapPassword}
                title={mfaTitleMessage}
                onSubmit={onSubmit}
            />
        );
    }

    return (
        <>
            <h3>
                <FormattedMessage
                    id='claim.ldap_to_oauth.title'
                    defaultMessage='Switch AD/LDAP Account to {type} SSO'
                    values={{type: formattedType}}
                />
            </h3>
            <p>
                <FormattedMessage
                    id='claim.ldap_to_oauth.ssoType'
                    defaultMessage='Upon claiming your account, you will only be able to login with {type} SSO. Your AD/LDAP credentials will no longer allow access to Mattermost.'
                    values={{type: formattedType}}
                />
            </p>
            <p>
                <FormattedMessage
                    id='claim.ldap_to_oauth.ssoNote'
                    defaultMessage='You must already have a valid {type} account'
                    values={{type: formattedType}}
                />
            </p>
            <form onSubmit={handleFormSubmit}>
                <p>
                    <FormattedMessage
                        id='claim.ldap_to_oauth.enterLdapPwd'
                        defaultMessage='{ldapPassword}:'
                        values={{ldapPassword: placeholderLDAPPassword}}
                    />
                </p>
                <div className={classNames('form-group', {'has-error': ldapPasswordError})}>
                    <input
                        type='password'
                        className='form-control'
                        name='ldapPassword'
                        placeholder={placeholderLDAPPassword}
                        spellCheck='false'
                        onChange={(e) => setLdapPassword(e.target.value)}
                    />
                </div>
                <ErrorLabel errorText={ldapPasswordError}/>

                <button
                    type='submit'
                    className='btn btn-primary'
                >
                    <FormattedMessage
                        id='claim.ldap_to_oauth.switchTo'
                        defaultMessage='Switch Account to {type}'
                        values={{type: formattedType}}
                    />
                </button>
                <ErrorLabel errorText={serverError}/>
            </form>
        </>
    );
}
