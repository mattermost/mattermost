// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {AuthChangeResponse} from '@mattermost/types/users';
import classNames from 'classnames';
import React, {useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import {oauthToEmail} from 'actions/admin_actions.jsx';

import LocalizedInput from 'components/localized_input/localized_input';

import Constants from 'utils/constants';
import {t} from 'utils/i18n';
import {getPasswordConfig, isValidPassword, localizeMessage, toTitleCase} from 'utils/utils';

import ErrorLabel from './error_label';

type Props = {
    currentType: string | null;
    email: string | null;
    siteName?: string;
    passwordConfig?: ReturnType<typeof getPasswordConfig>;
}

const OAuthToEmail = (props: Props) => {
    const passwordInput = useRef<HTMLInputElement>(null);
    const passwordConfirmInput = useRef<HTMLInputElement>(null);

    const [error, setError] = useState<string | JSX.Element>('');

    const submit = (e: React.FormEvent) => {
        e.preventDefault();

        const password = passwordInput.current?.value;
        if (!password) {
            setError(localizeMessage('claim.oauth_to_email.enterPwd', 'Please enter a password.'));
            return;
        }

        if (props.passwordConfig) {
            const {valid, error} = isValidPassword(password, props.passwordConfig);
            if (!valid && error) {
                setError(error);
                return;
            }
        }

        const confirmPassword = passwordConfirmInput.current?.value;
        if (!confirmPassword || password !== confirmPassword) {
            setError(localizeMessage('claim.oauth_to_email.pwdNotMatch', 'Passwords do not match.'));
            return;
        }

        setError('');

        oauthToEmail(
            props.currentType,
            props.email,
            password,
            (data: AuthChangeResponse) => {
                if (data?.follow_link) {
                    window.location.href = data.follow_link;
                }
            },
            (err: {message: string}) => {
                setError(err.message);
            },
        );
    };

    const uiType = `${(props.currentType === Constants.SAML_SERVICE ? Constants.SAML_SERVICE.toUpperCase() : toTitleCase(props.currentType || ''))} SSO`;
    const placeholderPasswordMessage = {id: t('claim.oauth_to_email.newPwd'), defaultMessage: 'New Password'};
    const placeholderConfirmMessage = {id: t('claim.oauth_to_email.confirm'), defaultMessage: 'Confirm Password'};

    return (
        <>
            <h3>
                <FormattedMessage
                    id='claim.oauth_to_email.title'
                    defaultMessage='Switch {type} Account to Email'
                    values={{type: uiType}}
                />
            </h3>
            <form onSubmit={submit}>
                <p>
                    <FormattedMessage
                        id='claim.oauth_to_email.description'
                        defaultMessage='Upon changing your account type, you will only be able to login with your email and password.'
                    />
                </p>
                <p>
                    <FormattedMessage
                        id='claim.oauth_to_email.enterNewPwd'
                        defaultMessage='Enter a new password for your {site} email account'
                        values={{site: props.siteName}}
                    />
                </p>
                <div className={classNames('form-group', {'has-error': error})}>
                    <LocalizedInput
                        type='password'
                        className='form-control'
                        name='password'
                        ref={passwordInput}
                        placeholder={placeholderPasswordMessage}
                        spellCheck='false'
                    />
                </div>
                <div className={classNames('form-group', {'has-error': error})}>
                    <LocalizedInput
                        type='password'
                        className='form-control'
                        name='passwordconfirm'
                        ref={passwordConfirmInput}
                        placeholder={placeholderConfirmMessage}
                        spellCheck='false'
                    />
                </div>
                <ErrorLabel errorText={error}/>
                <button
                    type='submit'
                    className='btn btn-primary'
                >
                    <FormattedMessage
                        id='claim.oauth_to_email.switchTo'
                        defaultMessage='Switch {type} to Email and Password'
                        values={{type: uiType}}
                    />
                </button>
            </form>
        </>
    );
};

export default OAuthToEmail;
