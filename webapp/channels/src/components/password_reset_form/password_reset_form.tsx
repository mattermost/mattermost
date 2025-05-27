// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState, useRef, memo, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useHistory} from 'react-router-dom';

import type {ActionResult} from 'mattermost-redux/types/actions';

import Constants from 'utils/constants';

export interface Props {
    location: {search: string};
    actions: {
        resetUserPassword: (token: string, newPassword: string) => Promise<ActionResult>;
    };
    siteName?: string;
}

const PasswordResetForm = ({location, siteName, actions}: Props) => {
    const intl = useIntl();

    const history = useHistory();

    const [error, setError] = useState<React.ReactNode>(null);

    const passwordInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        document.title = intl.formatMessage(
            {
                id: 'password_form.pageTitle',
                defaultMessage: 'Password Reset | {siteName}',
            },
            {siteName: siteName || 'Mattermost'},
        );
    }, [intl, siteName]);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();

        const password = passwordInput.current!.value;
        const token = (new URLSearchParams(location.search)).get('token');

        if (typeof token !== 'string') {
            throw new Error('token must be a string');
        }
        const {data, error} = await actions.resetUserPassword(token, password);
        if (data) {
            history.push('/login?extra=' + Constants.PASSWORD_CHANGE);
            setError(null);
        } else if (error) {
            setError(error.message);
        }
    };

    const errorElement = error ? (
        <div className='form-group has-error'>
            <label className='control-label'>
                {error}
            </label>
        </div>
    ) : null;

    return (
        <div className='col-sm-12'>
            <div className='signup-team__container'>
                <FormattedMessage
                    id='password_form.title'
                    tagName='h1'
                    defaultMessage='Password Reset'
                />
                <form onSubmit={handlePasswordReset}>
                    <p>
                        <FormattedMessage
                            id='password_form.enter'
                            defaultMessage='Enter a new password for your {siteName} account.'
                            values={{siteName}}
                        />
                    </p>
                    <div className={classNames('form-group', {'has-error': error})}>
                        <input
                            id='resetPasswordInput'
                            type='password'
                            className='form-control'
                            name='password'
                            ref={passwordInput}
                            placeholder={intl.formatMessage({
                                id: 'password_form.pwd',
                                defaultMessage: 'Password',
                            })}
                            spellCheck='false'
                            autoFocus={true}
                        />
                    </div>
                    {errorElement}
                    <button
                        id='resetPasswordButton'
                        type='submit'
                        className='btn btn-primary'
                    >
                        <FormattedMessage
                            id='password_form.change'
                            defaultMessage='Change my password'
                        />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default memo(PasswordResetForm);
