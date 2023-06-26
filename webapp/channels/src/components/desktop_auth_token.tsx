// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {FormattedMessage} from 'react-intl';

import classNames from 'classnames';

import {DesktopAuthStatus} from 'utils/desktop_app/auth';

import './desktop_auth_token.scss';

const BOTTOM_MESSAGE_TIMEOUT = 10000;

type Props = {
    authStatus: DesktopAuthStatus;

    onComplete: () => void;
    onLogin: () => void;
    onRestart: () => void;
}

const DesktopAuthToken: React.FC<Props> = ({authStatus, onComplete, onLogin, onRestart}: Props) => {
    const [showBottomMessage, setShowBottomMessage] = useState<React.ReactNode>();

    useEffect(() => {
        setShowBottomMessage(false);

        const timeout = setTimeout(() => {
            setShowBottomMessage(true);
        }, BOTTOM_MESSAGE_TIMEOUT) as unknown as number;

        return () => {
            clearTimeout(timeout);
        };
    }, [authStatus]);

    let mainMessage;
    let subMessage;
    let bottomMessage;

    if (authStatus === DesktopAuthStatus.Polling) {
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
                            <a onClick={onLogin}>
                                {chunks}
                            </a>
                        );
                    },
                }}
            />
        );
    }

    if (authStatus === DesktopAuthStatus.Complete) {
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
                            <a onClick={onComplete}>
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
                            <a onClick={onRestart}>
                                {chunks}
                            </a>
                        );
                    },
                }}
            />
        );
    }

    if (authStatus === DesktopAuthStatus.Expired) {
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
                            <a onClick={onRestart}>
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
            <p className={classNames('DesktopAuthToken__sub', {complete: authStatus === DesktopAuthStatus.Complete})}>
                {subMessage}
            </p>
            <div className='DesktopAuthToken__bottom'>
                {showBottomMessage ? bottomMessage : null}
            </div>
        </div>
    );
};

export default DesktopAuthToken;
