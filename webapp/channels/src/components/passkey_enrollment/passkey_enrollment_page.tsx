// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useLocation} from 'react-router-dom';

import {Button} from '@mattermost/compass-ui/components/button';
import {isDesktopApp} from '@mattermost/shared/utils/user_agent';

import {Client4} from 'mattermost-redux/client';

import LocalStorageStore from 'stores/local_storage_store';

import AlertBanner from 'components/alert_banner';
import ColumnLayout from 'components/header_footer_route/content_layouts/column';

import {createPasskey, verifyPasskey} from 'utils/passkeys';

import './passkey_enrollment_page.scss';

const messages = defineMessages({
    title: {
        id: 'passkey_enrollment_page.title',
        defaultMessage: 'Add a passkey',
        description: 'Title of the page, opened from the Mattermost app, where a passkey is added to the user\'s account.',
    },
    body: {
        id: 'passkey_enrollment_page.body',
        defaultMessage: 'Sign in with your fingerprint, face or screen lock. A passkey also lets you sign in if your usual sign-in method is unavailable.',
        description: 'Explanation shown above the button that adds a passkey, on the page opened from the Mattermost app.',
    },
    add: {
        id: 'passkey_enrollment_page.add',
        defaultMessage: 'Add passkey',
        description: 'Button that starts adding a passkey, on the page opened from the Mattermost app.',
    },
    alreadyHave: {
        id: 'passkey_enrollment_page.alreadyHave',
        defaultMessage: 'Use existing passkey',
        description: 'Button on the page opened from the Mattermost app for a user who already has a passkey for this account, for example one synced from another device; it checks the passkey instead of adding a duplicate.',
    },
    confirmed: {
        id: 'passkey_enrollment_page.confirmed',
        defaultMessage: 'Passkey confirmed. You can close this page and return to the app.',
        description: 'Shown after the user\'s existing passkey was checked on the page opened from the Mattermost app.',
    },
    noneRegistered: {
        id: 'passkey_enrollment_page.noneRegistered',
        defaultMessage: 'You don\'t have a passkey for this account yet. Add one instead.',
        description: 'Error shown when the user says they already have a passkey but their account has none.',
    },
    invalidCredential: {
        id: 'passkey_enrollment_page.invalidCredential',
        defaultMessage: 'That passkey doesn\'t belong to your account on this server. Choose another, or add a new one.',
        description: 'Error shown when the passkey the user chose is not one of their account\'s passkeys.',
    },
    done: {
        id: 'passkey_enrollment_page.done',
        defaultMessage: 'Passkey added. You can close this page and return to the app.',
        description: 'Shown after a passkey was added on the page opened from the Mattermost app.',
    },
    incomplete: {
        id: 'passkey_enrollment_page.incomplete',
        defaultMessage: 'This link is incomplete. Return to the app and try again.',
        description: 'Shown when the page opened from the Mattermost app has no enrollment ticket in its link.',
    },
    unsupported: {
        id: 'passkey_enrollment_page.unsupported',
        defaultMessage: 'This browser can\'t create passkeys. Open this page in a different browser.',
        description: 'Shown when the browser opening the passkey enrollment page has no WebAuthn support.',
    },
    desktop: {
        id: 'passkey_enrollment_page.desktop',
        defaultMessage: 'Open this page in your web browser.',
        description: 'Shown when the passkey enrollment page is opened inside the Mattermost desktop app, which cannot create passkeys.',
    },
    expired: {
        id: 'passkey_enrollment_page.expired',
        defaultMessage: 'This link has expired or was already used. Return to the app, sign in again and retry.',
        description: 'Error shown when the enrollment ticket in the page\'s link was already used, expired, or was issued to a session that did not sign in recently.',
    },
    unavailable: {
        id: 'passkey_enrollment_page.unavailable',
        defaultMessage: 'Passkeys aren\'t available on this server.',
        description: 'Error shown when the server has passkeys or passkey enrollment turned off.',
    },
    tooLong: {
        id: 'passkey_enrollment_page.tooLong',
        defaultMessage: 'That took too long. Try again.',
        description: 'Error shown when the passkey setup started on the page timed out on the server.',
    },
    alreadyOnDevice: {
        id: 'passkey_enrollment_page.alreadyOnDevice',
        defaultMessage: 'This device already has a passkey for your account. Choose "Use existing passkey".',
        description: 'Error shown when the device refuses to create a passkey because it already holds one for the account.',
    },
});

const terminalErrors: Record<string, typeof messages.expired> = {
    'app.passkey.ticket_invalid.app_error': messages.expired,
    'app.passkey.recent_login_required.app_error': messages.expired,
};

const retryableErrors: Record<string, typeof messages.expired> = {
    'app.passkey.ceremony_invalid.app_error': messages.tooLong,
};

// The add path returns invalid_credential for an attestation it cannot verify, so this wording is only true for verify.
const verifyErrors: Record<string, typeof messages.expired> = {
    'app.passkey.none_registered.app_error': messages.noneRegistered,
    'app.passkey.invalid_credential.app_error': messages.invalidCredential,
};

export default function PasskeyEnrollmentPage() {
    const {formatMessage} = useIntl();

    // The fragment is never sent to the server, so the ticket stays out of access logs.
    const ticket = new URLSearchParams(useLocation().hash.slice(1)).get('ticket');
    const [busy, setBusy] = useState<'add' | 'verify' | null>(null);
    const [done, setDone] = useState<'added' | 'confirmed' | null>(null);

    // A refusal that retrying cannot fix removes the button; any other error leaves it for another try.
    const [error, setError] = useState<{text: string; final: boolean} | null>(null);

    let message;
    let canAct = false;
    if (isDesktopApp()) {
        message = formatMessage(messages.desktop);
    } else if (typeof window.PublicKeyCredential === 'undefined') {
        message = formatMessage(messages.unsupported);
    } else if (!ticket) {
        message = formatMessage(messages.incomplete);
    } else if (done) {
        message = formatMessage(done === 'added' ? messages.done : messages.confirmed);
    } else {
        message = formatMessage(messages.body);
        canAct = !error?.final;
    }

    const run = async (kind: 'add' | 'verify', action: () => Promise<boolean>, result: 'added' | 'confirmed', extraErrors: typeof verifyErrors = {}) => {
        setBusy(kind);
        setError(null);
        try {
            if (await action()) {
                LocalStorageStore.setPasskeyEnrolled();
                setDone(result);
            }
        } catch (e) {
            const err = e as Error & {server_error_id?: string; status_code?: number};
            const id = err.server_error_id ?? '';
            if (terminalErrors[id]) {
                setError({text: formatMessage(terminalErrors[id]), final: true});
            } else if (err.status_code === 501) {
                setError({text: formatMessage(messages.unavailable), final: true});
            } else if (retryableErrors[id] ?? extraErrors[id]) {
                setError({text: formatMessage(retryableErrors[id] ?? extraErrors[id]), final: false});
            } else if (err.name === 'InvalidStateError') {
                setError({text: formatMessage(messages.alreadyOnDevice), final: false});
            } else {
                setError({text: err.message, final: false});
            }
        }
        setBusy(null);
    };

    const add = () => run('add', async () => Boolean(await createPasskey(
        () => Client4.beginPasskeyEnrollmentRegistration(ticket!),
        (ceremonyId, credential) => Client4.finishPasskeyEnrollmentRegistration(ceremonyId, '', credential),
    )), 'added');

    const verifyExisting = () => run('verify', () => verifyPasskey(
        () => Client4.beginPasskeyEnrollmentVerification(ticket!),
        (ceremonyId, credential) => Client4.finishPasskeyEnrollmentVerification(ceremonyId, credential),
    ), 'confirmed', verifyErrors);

    return (
        <ColumnLayout
            title={formatMessage(messages.title)}
            message={message}
            extraContent={(
                <div className='PasskeyEnrollmentPage__actions'>
                    {error && (
                        <div role='alert'>
                            <AlertBanner
                                mode='danger'
                                title={error.text}
                            />
                        </div>
                    )}
                    {canAct && (
                        <>
                            <Button
                                emphasis='primary'
                                size='large'
                                loading={busy === 'add'}
                                disabled={busy !== null}
                                onClick={add}
                            >
                                {formatMessage(messages.add)}
                            </Button>
                            <Button
                                emphasis='tertiary'
                                size='large'
                                loading={busy === 'verify'}
                                disabled={busy !== null}
                                onClick={verifyExisting}
                            >
                                {formatMessage(messages.alreadyHave)}
                            </Button>
                        </>
                    )}
                </div>
            )}
        />
    );
}
