// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory, useLocation} from 'react-router-dom';

import crypto from 'crypto';
import classNames from 'classnames';

import {UserProfile} from '@mattermost/types/users';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {loginWithDesktopToken} from 'actions/views/login';

import './desktop_auth_token.scss';

const BOTTOM_MESSAGE_TIMEOUT = 10000;
const POLLING_INTERVAL = 2000;

enum DesktopAuthStatus {
    None,
    Polling,
    Expired,
    Complete,
}

type Props = {
    href: string;
    onLogin: (userProfile: UserProfile) => void;
}

const DesktopAuthToken: React.FC<Props> = ({href, onLogin}: Props) => {
    const dispatch = useDispatch<DispatchFunc>();
    const history = useHistory();
    const {search} = useLocation();
    const query = new URLSearchParams(search);

    const [status, setStatus] = useState(query.get('desktopAuthComplete') ? DesktopAuthStatus.Complete : DesktopAuthStatus.None);
    const [token, setToken] = useState('');
    const [showBottomMessage, setShowBottomMessage] = useState<React.ReactNode>();

    const interval = useRef<NodeJS.Timer>();

    const {SiteURL} = useSelector(getConfig);

    const tryDesktopLogin = async () => {
        const {data: userProfile, error: loginError} = await dispatch(loginWithDesktopToken(token));

        if (loginError && loginError.server_error_id && loginError.server_error_id.length !== 0) {
            if (loginError.server_error_id === 'app.desktop_token.validate.expired') {
                clearInterval(interval.current as unknown as number);
                setStatus(DesktopAuthStatus.Expired);
            }
            return;
        }

        clearInterval(interval.current as unknown as number);
        setStatus(DesktopAuthStatus.Complete);
        await onLogin(userProfile as UserProfile);
    };

    const getExternalLoginURL = () => {
        const parsedURL = new URL(href);

        const params = new URLSearchParams(parsedURL.searchParams);
        params.set('desktop_token', token);

        return `${parsedURL.origin}${parsedURL.pathname}?${params.toString()}`;
    };

    const openDesktopApp = () => {
        if (!SiteURL) {
            return;
        }
        const url = new URL(SiteURL);
        const redirectTo = query.get('redirect_to');
        if (redirectTo) {
            url.pathname += redirectTo;
        }
        url.protocol = 'mattermost';
        window.location.href = url.toString();
    };

    useEffect(() => {
        setShowBottomMessage(false);

        const timeout = setTimeout(() => {
            setShowBottomMessage(true);
        }, BOTTOM_MESSAGE_TIMEOUT) as unknown as number;

        return () => {
            clearTimeout(timeout);
        };
    }, [status]);

    useEffect(() => {
        if (!token) {
            return () => {};
        }

        const url = getExternalLoginURL();
        window.open(url);

        setStatus(DesktopAuthStatus.Polling);
        interval.current = setInterval(tryDesktopLogin, POLLING_INTERVAL);

        return () => {
            clearInterval(interval.current as unknown as number);
        };
    }, [token]);

    useEffect(() => {
        if (status === DesktopAuthStatus.Complete) {
            openDesktopApp();
            return;
        }

        setToken(crypto.randomBytes(32).toString('hex'));
    }, []);

    let mainMessage;
    let subMessage;
    let bottomMessage;

    if (status === DesktopAuthStatus.Polling) {
        mainMessage = (
            <FormattedMessage
                id='desktop_auth_token.polling.redirectingToBrowser'
                defaultMessage='Redirecting to browser...'
            />
        );
        subMessage = (
            <FormattedMessage
                id='desktop_auth_token.polling.awaitingToken'
                defaultMessage='Authenticating in the browser, awaiting valid token.'
            />
        );

        bottomMessage = (
            <FormattedMessage
                id='desktop_auth_token.polling.isComplete'
                defaultMessage='Authentication complete? <a>Check token now</a>'
                values={{
                    a: (chunks: React.ReactNode) => {
                        return (
                            <a onClick={tryDesktopLogin}>
                                {chunks}
                            </a>
                        );
                    },
                }}
            />
        );
    }

    if (status === DesktopAuthStatus.Complete) {
        mainMessage = (
            <FormattedMessage
                id='desktop_auth_token.complete.youAreNowLoggedIn'
                defaultMessage='You are now logged in'
            />
        );
        subMessage = (
            <FormattedMessage
                id='desktop_auth_token.complete.openMattermost'
                defaultMessage='Click on <b>Open Mattermost</b> in the browser prompt to <a>launch the desktop app</a>'
                values={{
                    a: (chunks: React.ReactNode) => {
                        return (
                            <a onClick={openDesktopApp}>
                                {chunks}
                            </a>
                        );
                    },
                    b: (chunks: React.ReactNode) => (<b>{chunks}</b>),
                }}
            />
        );

        bottomMessage = (
            <FormattedMessage
                id='desktop_auth_token.complete.havingTrouble'
                defaultMessage='Having trouble logging in? <a>Open Mattermost in your browser</a>'
                values={{
                    a: (chunks: React.ReactNode) => {
                        return (
                            <a onClick={() => history.push('/')}>
                                {chunks}
                            </a>
                        );
                    },
                }}
            />
        );
    }

    if (status === DesktopAuthStatus.Expired) {
        mainMessage = (
            <FormattedMessage
                id='desktop_auth_token.expired.somethingWentWrong'
                defaultMessage='Something went wrong'
            />
        );
        subMessage = (
            <FormattedMessage
                id='desktop_auth_token.expired.restartFlow'
                defaultMessage={'Click <a>here</a> to try again.'}
                values={{
                    a: (chunks: React.ReactNode) => {
                        return (
                            <a onClick={() => history.push('/')}>
                                {chunks}
                            </a>
                        );
                    },
                }}
            />
        );
        bottomMessage = null;
    }

    return (
        <div className='DesktopAuthToken'>
            <h1 className='DesktopAuthToken__main'>
                {mainMessage}
            </h1>
            <p className={classNames('DesktopAuthToken__sub', {complete: status === DesktopAuthStatus.Complete})}>
                {subMessage}
            </p>
            <div className='DesktopAuthToken__bottom'>
                {showBottomMessage ? bottomMessage : null}
            </div>
        </div>
    );
};

export default DesktopAuthToken;
