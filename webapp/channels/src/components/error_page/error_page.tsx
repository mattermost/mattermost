// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router-dom';

import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import {ErrorPageTypes, Constants} from 'utils/constants';

import ErrorMessage from './error_message';
import ErrorTitle from './error_title';

type Location = {
    search: string;
}

type Props = {
    location: Location;
    asymmetricSigningPublicKey?: string;
    siteName?: string;
    isGuest?: boolean;
}

/**
 * Verify a signature using Web Crypto API (browser-compatible)
 * @param publicKeyBase64 - Base64-encoded SPKI public key (without PEM headers)
 * @param data - The data that was signed
 * @param signatureBase64 - Base64-encoded signature
 * @returns Promise<boolean> - Whether the signature is valid
 */
async function verifySignature(publicKeyBase64: string, data: string, signatureBase64: string): Promise<boolean> {
    try {
        // Decode base64 public key to ArrayBuffer
        const keyBytes = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));

        // Import the public key using Web Crypto API (SPKI format)
        const publicKey = await globalThis.crypto.subtle.importKey(
            'spki',
            keyBytes.buffer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: 'SHA-256',
            },
            false,
            ['verify'],
        );

        // Decode base64 signature
        const signatureBytes = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));

        // Encode data as UTF-8
        const dataBytes = new TextEncoder().encode(data);

        // Verify the signature
        return await globalThis.crypto.subtle.verify(
            'RSASSA-PKCS1-v1_5',
            publicKey,
            signatureBytes.buffer,
            dataBytes.buffer,
        );
    } catch {
        return false;
    }
}

export default function ErrorPage({location, asymmetricSigningPublicKey, siteName, isGuest}: Props) {
    const [trustParams, setTrustParams] = useState(false);

    const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const signature = params.get('s');

    useEffect(() => {
        document.body.setAttribute('class', 'sticky error');
        return () => {
            document.body.removeAttribute('class');
        };
    }, []);

    useEffect(() => {
        async function verifyParams() {
            if (!signature || !asymmetricSigningPublicKey) {
                setTrustParams(false);
                return;
            }

            const paramsWithoutSignature = new URLSearchParams(params);
            paramsWithoutSignature.delete('s');

            const dataToVerify = '/error?' + paramsWithoutSignature.toString();
            const isValid = await verifySignature(asymmetricSigningPublicKey, dataToVerify, signature);
            setTrustParams(isValid);
        }

        verifyParams();
    }, [signature, asymmetricSigningPublicKey, params]);

    const type = params.get('type');
    const title = (trustParams && params.get('title')) || '';
    const message = (trustParams && params.get('message')) || '';
    const service = (trustParams && params.get('service')) || '';
    const returnTo = (trustParams && params.get('returnTo')) || '';

    let backButton;
    if (type === ErrorPageTypes.PERMALINK_NOT_FOUND && returnTo) {
        backButton = (
            <Link to={returnTo}>
                <FormattedMessage
                    id='error.generic.link'
                    defaultMessage='Back to Mattermost'
                />
            </Link>
        );
    } else if (type === ErrorPageTypes.CLOUD_ARCHIVED && returnTo) {
        backButton = (
            <Link to={returnTo}>
                <FormattedMessage
                    id='error.generic.link'
                    defaultMessage='Back to Mattermost'
                />
            </Link>
        );
    } else if (type === ErrorPageTypes.TEAM_NOT_FOUND) {
        backButton = (
            <Link to='/'>
                <FormattedMessage
                    id='error.generic.siteLink'
                    defaultMessage='Back to {siteName}'
                    values={{
                        siteName,
                    }}
                />
            </Link>
        );
    } else if (type === ErrorPageTypes.CHANNEL_NOT_FOUND && isGuest) {
        backButton = (
            <Link to='/'>
                <FormattedMessage
                    id='error.channelNotFound.guest_link'
                    defaultMessage='Back'
                />
            </Link>
        );
    } else if (type === ErrorPageTypes.CHANNEL_NOT_FOUND) {
        backButton = (
            <Link to={returnTo}>
                <FormattedMessage
                    id='error.channelNotFound.link'
                    defaultMessage='Back to {defaultChannelName}'
                    values={{
                        defaultChannelName: Constants.DEFAULT_CHANNEL_UI_NAME,
                    }}
                />
            </Link>
        );
    } else if (type === ErrorPageTypes.OAUTH_ACCESS_DENIED || type === ErrorPageTypes.OAUTH_MISSING_CODE) {
        backButton = (
            <Link to='/'>
                <FormattedMessage
                    id='error.generic.link_login'
                    defaultMessage='Back to Login Page'
                />
            </Link>
        );
    } else if (type === ErrorPageTypes.OAUTH_INVALID_PARAM || type === ErrorPageTypes.OAUTH_INVALID_REDIRECT_URL) {
        backButton = null;
    } else {
        backButton = (
            <Link to='/'>
                <FormattedMessage
                    id='error.generic.siteLink'
                    defaultMessage='Back to {siteName}'
                    values={{
                        siteName,
                    }}
                />
            </Link>
        );
    }

    return (
        <div className='container-fluid'>
            <div className='error__container'>
                <div className='error__icon'>
                    <WarningIcon/>
                </div>
                <h2 data-testid='errorMessageTitle'>
                    <ErrorTitle
                        type={type}
                        title={title}
                    />
                </h2>
                <ErrorMessage
                    type={type}
                    message={message}
                    service={service}
                    isGuest={isGuest}
                />
                {backButton}
            </div>
        </div>
    );
}
