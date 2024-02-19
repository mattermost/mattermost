// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AuthChangeResponse} from '@mattermost/types/users';

import {emailToOAuth} from 'actions/admin_actions.jsx';

import LoginMfa from 'components/login/login_mfa';

import Constants, {ClaimErrors} from 'utils/constants';
import {toTitleCase} from 'utils/utils';

import type {SubmitOptions} from './email_to_ldap';
import ErrorLabel from './error_label';

type Props = {
    newType: string | null;
    email: string;
    siteName?: string;
}

const EmailToOAuth = (props: Props) => {
    const {formatMessage} = useIntl();

    const [showMfa, setShowMfa] = useState(false);
    const [password, setPassword] = useState('');
    const [serverError, setServerError] = useState<string>('');
    const passwordInput = useRef<HTMLInputElement>(null);

    const preSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const password = passwordInput.current?.value;
        if (!password) {
            setServerError(formatMessage({id: 'claim.email_to_oauth.pwdError', defaultMessage: 'Please enter your password.'}));
            return;
        }

        setPassword(password);

        setServerError('');

        submit({loginId: props.email, password});
    };

    const submit = ({loginId, password, token = ''}: SubmitOptions) => {
        emailToOAuth(
            loginId,
            password,
            token,
            props.newType,
            (data: AuthChangeResponse) => {
                if (data.follow_link) {
                    window.location.href = data.follow_link;
                }
            },
            (err: {server_error_id: string; message: string}) => {
                if (!showMfa && err.server_error_id === ClaimErrors.MFA_VALIDATE_TOKEN_AUTHENTICATE) {
                    setShowMfa(true);
                } else {
                    setServerError(err.message);
                    setShowMfa(false);
                }
            },
        );
    };

    const type = (props.newType === Constants.SAML_SERVICE ? Constants.SAML_SERVICE.toUpperCase() : toTitleCase(props.newType || ''));
    const uiType = `${type} SSO`;

    if (showMfa) {
        return (
            <LoginMfa
                loginId={props.email}
                password={password}
                title={formatMessage({id: 'claim.email_to_oauth.title', defaultMessage: 'Switch Email/Password Account to {uiType}'})}
                onSubmit={submit}
            />
        );
    }
    return (
        <>
            <h3>
                <FormattedMessage
                    id='claim.email_to_oauth.title'
                    defaultMessage='Switch Email/Password Account to {uiType}'
                    values={{uiType}}
                />
            </h3>
            <form onSubmit={preSubmit}>
                <p>
                    <FormattedMessage
                        id='claim.email_to_oauth.ssoType'
                        defaultMessage='Upon claiming your account, you will only be able to login with {type} SSO'
                        values={{type}}
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='claim.email_to_oauth.ssoNote'
                        defaultMessage='You must already have a valid {type} account'
                        values={{type}}
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='claim.email_to_oauth.enterPwd'
                        defaultMessage='Enter the password for your {site} account'
                        values={{site: props.siteName}}
                    />
                </p>
                <div className={classNames('form-group', {'has-error': serverError})}>
                    <input
                        type='password'
                        className='form-control'
                        name='password'
                        ref={passwordInput}
                        placeholder={formatMessage({id: 'claim.email_to_oauth.pwd', defaultMessage: 'Password'})}
                        spellCheck='false'
                    />
                </div>
                <ErrorLabel errorText={serverError}/>
                <button
                    type='submit'
                    className='btn btn-primary'
                >
                    <FormattedMessage
                        id='claim.email_to_oauth.switchTo'
                        defaultMessage='Switch Account to {uiType}'
                        values={{uiType}}
                    />
                </button>
            </form>
        </>
    );
};

export default EmailToOAuth;

