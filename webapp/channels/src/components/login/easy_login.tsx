// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';
import {useLocation, useHistory} from 'react-router-dom';

import {loginPasswordless} from 'actions/views/login';

import MattermostLoadingIndicator from 'components/mattermost_loading_indicator';

import './easy_login.scss';

const EasyLogin = () => {
    const {formatMessage} = useIntl();
    const location = useLocation();
    const history = useHistory();
    const dispatch = useDispatch();

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const token = searchParams.get('t');

        if (!token) {
            const errorMessage = formatMessage({
                id: 'easy_login.no_token',
                defaultMessage: 'Invalid login link. Please request a new one.',
            });

            // Redirect to login page with error message
            history.push(`/login?extra=login_error&message=${encodeURIComponent(errorMessage)}`);
            return;
        }

        // Dispatch loginPasswordless with the token
        const handleLogin = async () => {
            const result = await dispatch(loginPasswordless(token));

            if (result.error) {
                const errorMessage = result.error.message || formatMessage({
                    id: 'easy_login.error',
                    defaultMessage: 'We were unable to log you in. Please enter your details and try again.',
                });

                // Redirect to login page with error message
                history.push(`/login?extra=login_error&message=${encodeURIComponent(errorMessage)}`);
            } else {
                // Login successful - redirect will be handled by the login action
                history.push('/');
            }
        };

        handleLogin();
    }, [location.search, dispatch, history, formatMessage]);

    return (
        <div className='easy-login'>
            <div className='easy-login-content'>
                <MattermostLoadingIndicator/>
                <h1>
                    {formatMessage({
                        id: 'easy_login.title',
                        defaultMessage: 'Logging you in',
                    })}
                </h1>
                <p>
                    {formatMessage({
                        id: 'easy_login.description',
                        defaultMessage: 'This will only take a moment',
                    })}
                </p>
            </div>
        </div>
    );
};

export default EasyLogin;

