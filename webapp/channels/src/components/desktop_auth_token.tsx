// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import crypto from 'crypto';
import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';
import {useHistory, useLocation} from 'react-router-dom';

import {loginWithDesktopToken} from 'actions/views/login';

import DesktopApp from 'utils/desktop_api';

import './desktop_auth_token.scss';

const BOTTOM_MESSAGE_TIMEOUT = 10000;
const DESKTOP_AUTH_PREFIX = 'desktop_auth_client_token';

enum DesktopAuthStatus {
    None,
    WaitingForBrowser,
    LoggedIn,
    Authenticating,
    Error,
}

type Props = {
    href: string;
    onLogin: () => void;
}

const DesktopAuthToken: React.FC<Props> = ({href, onLogin}: Props) => {
    const dispatch = useDispatch();
    const history = useHistory();
    const {search} = useLocation();
    const query = new URLSearchParams(search);

    const serverToken = query.get('server_token');
    const receivedClientToken = query.get('client_token');
    const storedClientToken = sessionStorage.getItem(DESKTOP_AUTH_PREFIX);
    const [status, setStatus] = useState(serverToken ? DesktopAuthStatus.LoggedIn : DesktopAuthStatus.None);
    const [showBottomMessage, setShowBottomMessage] = useState<boolean>();

    const tryDesktopLogin = async () => {
        if (!(serverToken && receivedClientToken === storedClientToken)) {
            setStatus(DesktopAuthStatus.Error);
            return;
        }

        sessionStorage.removeItem(DESKTOP_AUTH_PREFIX);
        const {error: loginError} = await dispatch(loginWithDesktopToken(serverToken));

        if (loginError && loginError.server_error_id && loginError.server_error_id.length !== 0) {
            setStatus(DesktopAuthStatus.Error);
            return;
        }

        setStatus(DesktopAuthStatus.LoggedIn);
        await onLogin();
    };

    const openExternalLoginURL = async () => {
        const desktopToken = `${DesktopApp.isDev() ? 'dev-' : ''}${crypto.randomBytes(32).toString('hex')}`.slice(0, 64);
        sessionStorage.setItem(DESKTOP_AUTH_PREFIX, desktopToken);
        const parsedURL = new URL(href);

        const params = new URLSearchParams(parsedURL.searchParams);
        params.set('desktop_token', desktopToken);

        window.open(`${parsedURL.origin}${parsedURL.pathname}?${params.toString()}`);
        setStatus(DesktopAuthStatus.WaitingForBrowser);
    };

    const forwardToDesktopApp = () => {
        const url = new URL(window.location.href);
        let protocol = 'mattermost';
        if (url.searchParams.get('isDesktopDev')) {
            protocol = 'mattermost-dev';
        }

        window.location.href = url.toString().replace(url.protocol, `${protocol}:`);
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
        if (serverToken) {
            if (storedClientToken) {
                tryDesktopLogin();
            } else {
                forwardToDesktopApp();
            }
            return;
        }

        openExternalLoginURL();
    }, [serverToken]);

    let mainMessage;
    let subMessage;
    let bottomMessage;

    if (status === DesktopAuthStatus.WaitingForBrowser) {
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

        bottomMessage = null;
    }

    if (status === DesktopAuthStatus.LoggedIn) {
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
                            <a onClick={forwardToDesktopApp}>
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

    if (status === DesktopAuthStatus.Error) {
        mainMessage = (
            <FormattedMessage
                id='desktop_auth_token.error.somethingWentWrong'
                defaultMessage='Something went wrong'
            />
        );
        subMessage = (
            <FormattedMessage
                id='desktop_auth_token.error.restartFlow'
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
            <p className={classNames('DesktopAuthToken__sub', {complete: status === DesktopAuthStatus.LoggedIn})}>
                {subMessage}
            </p>
            <div className='DesktopAuthToken__bottom'>
                {showBottomMessage ? bottomMessage : null}
            </div>
        </div>
    );
};

export default DesktopAuthToken;
