// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
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

type State = {
    trustParams: boolean;
    verified: boolean;
}

/**
 * Convert DER-encoded ECDSA signature to IEEE P1363 format (r || s)
 * Web Crypto API expects P1363 format, but Node.js crypto produces DER format
 */
function derToP1363(derSig: Uint8Array): Uint8Array {
    // DER format: 0x30 [total-len] 0x02 [r-len] [r] 0x02 [s-len] [s]
    let offset = 2; // skip 0x30 and length byte

    // Parse r
    if (derSig[offset] !== 0x02) {
        throw new Error('Invalid DER signature: expected 0x02 for r');
    }
    offset++;
    const rLen = derSig[offset++];
    let r = derSig.slice(offset, offset + rLen);
    offset += rLen;

    // Parse s
    if (derSig[offset] !== 0x02) {
        throw new Error('Invalid DER signature: expected 0x02 for s');
    }
    offset++;
    const sLen = derSig[offset++];
    let s = derSig.slice(offset, offset + sLen);

    // Remove leading zeros and pad to 32 bytes for P-256
    while (r.length > 32 && r[0] === 0) {
        r = r.slice(1);
    }
    while (s.length > 32 && s[0] === 0) {
        s = s.slice(1);
    }
    while (r.length < 32) {
        const padded = new Uint8Array(r.length + 1);
        padded[0] = 0;
        padded.set(r, 1);
        r = padded;
    }
    while (s.length < 32) {
        const padded = new Uint8Array(s.length + 1);
        padded[0] = 0;
        padded.set(s, 1);
        s = padded;
    }

    // Concatenate r || s (64 bytes for P-256)
    const p1363 = new Uint8Array(64);
    p1363.set(r, 0);
    p1363.set(s, 32);
    return p1363;
}

/**
 * Verify a signature using Web Crypto API (browser-compatible)
 * Uses ECDSA P-256 with SHA-256 (what the Mattermost server uses)
 */
async function verifySignatureAsync(publicKeyBase64: string, data: string, signatureUrlSafeBase64: string): Promise<boolean> {
    try {
        // Convert URL-safe base64 to standard base64
        // URL-safe base64 uses - instead of + and _ instead of /
        const signatureBase64 = signatureUrlSafeBase64.replace(/-/g, '+').replace(/_/g, '/');

        // Decode base64 public key to ArrayBuffer
        const keyBytes = Uint8Array.from(atob(publicKeyBase64), (c) => c.charCodeAt(0));

        // Decode base64 signature (DER format from server)
        const derSignatureBytes = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));

        // Convert DER to P1363 format (what Web Crypto expects)
        const p1363SignatureBytes = derToP1363(derSignatureBytes);

        // Encode data as UTF-8
        const dataBytes = new TextEncoder().encode(data);

        // Import ECDSA P-256 public key
        const ecdsaKey = await globalThis.crypto.subtle.importKey(
            'spki',
            keyBytes.buffer,
            {
                name: 'ECDSA',
                namedCurve: 'P-256',
            },
            false,
            ['verify'],
        );

        // Verify the signature
        return await globalThis.crypto.subtle.verify(
            {
                name: 'ECDSA',
                hash: 'SHA-256',
            },
            ecdsaKey,
            p1363SignatureBytes.buffer,
            dataBytes.buffer,
        );
    } catch {
        return false;
    }
}

export default class ErrorPage extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            trustParams: false,
            verified: false,
        };
    }

    public componentDidMount() {
        document.body.setAttribute('class', 'sticky error');
        this.verifySignature();
    }

    public componentWillUnmount() {
        document.body.removeAttribute('class');
    }

    private async verifySignature() {
        const params: URLSearchParams = new URLSearchParams(this.props.location.search);
        const signature = params.get('s');

        if (signature) {
            params.delete('s');

            const key = this.props.asymmetricSigningPublicKey;
            if (key) {
                const dataToVerify = '/error?' + params.toString();
                const isValid = await verifySignatureAsync(key, dataToVerify, signature);
                this.setState({trustParams: isValid, verified: true});
                return;
            }
        }

        this.setState({trustParams: false, verified: true});
    }

    public render() {
        const {isGuest} = this.props;
        const {trustParams, verified} = this.state;

        // Don't render until verification is complete
        if (!verified) {
            return null;
        }

        const params: URLSearchParams = new URLSearchParams(this.props.location.search);
        params.delete('s');

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
                            siteName: this.props.siteName,
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
                            siteName: this.props.siteName,
                        }}
                    />
                </Link>
            );
        }

        const errorPage = (
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

        return (
            <>
                {errorPage}
            </>
        );
    }
}
