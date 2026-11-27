// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {Button} from '@mattermost/compass-ui/components/button';
import {GenericModal} from '@mattermost/components';
import type {ServerError} from '@mattermost/types/errors';
import type {MobileQRLoginToken} from '@mattermost/types/users';

import {createMobileQRLoginToken} from 'mattermost-redux/actions/users';

import './mobile_qr_login_modal.scss';

type Props = {
    onExited?: () => void;
    onHide?: () => void;
};

type State = {status: 'loading'} |
{status: 'ready'; token: MobileQRLoginToken; totalSeconds: number} |
{status: 'error'; forbidden: boolean};

const HTTP_FORBIDDEN = 403;

function secondsUntil(expiresAt: number, now: number) {
    return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

function formatCountdown(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function MobileQRLoginModal({onExited, onHide}: Props) {
    const intl = useIntl();
    const dispatch = useDispatch();

    const [state, setState] = useState<State>({status: 'loading'});
    const [now, setNow] = useState(() => Date.now());
    const requestId = useRef(0);
    const isMounted = useRef(true);

    const generate = useCallback(async () => {
        const currentRequest = ++requestId.current;
        setState({status: 'loading'});

        const result = await dispatch(createMobileQRLoginToken());
        if (!isMounted.current || currentRequest !== requestId.current) {
            return;
        }

        if ('error' in result && result.error) {
            const error = result.error as ServerError;
            setState({status: 'error', forbidden: error.status_code === HTTP_FORBIDDEN});
            return;
        }

        const token = result.data as MobileQRLoginToken;
        const received = Date.now();
        setNow(received);
        setState({status: 'ready', token, totalSeconds: secondsUntil(token.expires_at, received)});
    }, [dispatch]);

    useEffect(() => {
        isMounted.current = true;
        generate();

        return () => {
            isMounted.current = false;
        };
    }, [generate]);

    const expiresAt = state.status === 'ready' ? state.token.expires_at : 0;
    const isExpired = state.status === 'ready' && now >= expiresAt;

    useEffect(() => {
        if (state.status !== 'ready' || isExpired) {
            return undefined;
        }

        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, [state.status, expiresAt, isExpired]);

    const generateButton = (label: React.ReactNode) => (
        <Button
            type='button'
            emphasis='secondary'
            onClick={generate}
        >
            {label}
        </Button>
    );

    let stage: React.ReactNode;
    if (state.status === 'loading') {
        stage = (
            <p
                role='status'
                className='MobileQRLoginModal__status'
            >
                <FormattedMessage
                    id='mobile_qr_login_modal.loading'
                    defaultMessage='Generating code…'
                />
            </p>
        );
    } else if (state.status === 'error') {
        stage = (
            <>
                <p
                    role='alert'
                    className='MobileQRLoginModal__status'
                >
                    {state.forbidden ? (
                        <FormattedMessage
                            id='mobile_qr_login_modal.error.forbidden'
                            defaultMessage="You can't create a sign-in code from this session."
                        />
                    ) : (
                        <FormattedMessage
                            id='mobile_qr_login_modal.error.generic'
                            defaultMessage="We couldn't generate a sign-in code. Try again."
                        />
                    )}
                </p>
                {!state.forbidden && generateButton(
                    <FormattedMessage
                        id='mobile_qr_login_modal.retry'
                        defaultMessage='Try again'
                    />,
                )}
            </>
        );
    } else if (isExpired) {
        stage = (
            <>
                <p
                    role='status'
                    className='MobileQRLoginModal__status'
                >
                    <FormattedMessage
                        id='mobile_qr_login_modal.expired'
                        defaultMessage='This code has expired.'
                    />
                </p>
                {generateButton(
                    <FormattedMessage
                        id='mobile_qr_login_modal.generate_new'
                        defaultMessage='Generate new code'
                    />,
                )}
            </>
        );
    } else {
        stage = (
            <img
                className='MobileQRLoginModal__qr'
                src={`data:image/png;base64,${state.token.qr_code}`}
                alt={intl.formatMessage({
                    id: 'mobile_qr_login_modal.qr_alt',
                    defaultMessage: 'QR code to sign in to the Mattermost mobile app',
                })}
            />
        );
    }

    return (
        <GenericModal
            id='mobileQRLoginModal'
            className='MobileQRLoginModal'
            compassDesign={true}
            modalHeaderText={intl.formatMessage({
                id: 'mobile_qr_login_modal.title',
                defaultMessage: 'Sign in on mobile',
            })}
            onHide={onHide}
            onExited={onExited}
        >
            <div className='MobileQRLoginModal__body'>
                <p className='MobileQRLoginModal__instructions'>
                    {state.status === 'ready' ? (
                        <FormattedMessage
                            id='mobile_qr_login_modal.instructions'
                            defaultMessage="Scan this code with your phone's camera to sign in to the Mattermost mobile app. The code works once and expires in {seconds, plural, one {# second} other {# seconds}}. Don't share it."
                            values={{seconds: state.totalSeconds}}
                        />
                    ) : (
                        <FormattedMessage
                            id='mobile_qr_login_modal.instructions_generic'
                            defaultMessage="Scan the code with your phone's camera to sign in to the Mattermost mobile app. The code works once and expires quickly. Don't share it."
                        />
                    )}
                </p>
                <div className='MobileQRLoginModal__stage'>
                    {stage}
                </div>
                {state.status === 'ready' && !isExpired && (
                    <p className='MobileQRLoginModal__countdown'>
                        <FormattedMessage
                            id='mobile_qr_login_modal.countdown'
                            defaultMessage='Expires in {time}'
                            values={{time: formatCountdown(secondsUntil(expiresAt, now))}}
                        />
                    </p>
                )}
            </div>
        </GenericModal>
    );
}
