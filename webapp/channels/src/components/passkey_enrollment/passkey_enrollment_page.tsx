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

import {sharedMessages, verifyErrors} from './messages';

import './passkey_enrollment_page.scss';

const messages = defineMessages({
    confirmedTitle: {
        id: 'passkey_enrollment_page.confirmedTitle',
        defaultMessage: 'Passkey confirmed',
        description: 'Title shown after the user\'s existing passkey was checked on the page opened from the Mattermost app.',
    },
    addedTitle: {
        id: 'passkey_enrollment_page.addedTitle',
        defaultMessage: 'Passkey added',
        description: 'Title shown after a passkey was added on the page opened from the Mattermost app.',
    },
    returnToApp: {
        id: 'passkey_enrollment_page.returnToApp',
        defaultMessage: 'You can close this page and return to the app.',
        description: 'Shown after a passkey was added or confirmed on the page opened from the Mattermost app.',
    },
    cantAdd: {
        id: 'passkey_enrollment_page.cantAdd',
        defaultMessage: 'Can\'t add a passkey here',
        description: 'Title of the page, opened from the Mattermost app, when a passkey cannot be added: in the desktop app, in a browser without passkey support, from an incomplete link, or after an error that cannot be retried.',
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

export default function PasskeyEnrollmentPage() {
    const {formatMessage} = useIntl();

    // The fragment is never sent to the server, so the ticket stays out of access logs.
    const ticket = new URLSearchParams(useLocation().hash.slice(1)).get('ticket');
    const [busy, setBusy] = useState<'add' | 'verify' | null>(null);
    const [done, setDone] = useState<'added' | 'confirmed' | null>(null);

    // A refusal that retrying cannot fix removes the button; any other error leaves it for another try.
    const [error, setError] = useState<{text: string; final: boolean} | null>(null);

    let title = sharedMessages.title;
    let message: React.ReactNode;
    let canAct = false;
    if (isDesktopApp()) {
        title = messages.cantAdd;
        message = formatMessage(messages.desktop);
    } else if (typeof window.PublicKeyCredential === 'undefined') {
        title = messages.cantAdd;
        message = formatMessage(messages.unsupported);
    } else if (!ticket) {
        title = messages.cantAdd;
        message = formatMessage(messages.incomplete);
    } else if (done) {
        title = done === 'added' ? messages.addedTitle : messages.confirmedTitle;
        message = formatMessage(messages.returnToApp);
    } else if (error?.final) {
        title = messages.cantAdd;

        // Final errors get no banner (which carries the alert role), so the subtitle announces the refusal itself.
        message = <span role='alert'>{error.text}</span>;
    } else {
        message = formatMessage(sharedMessages.body);
        canAct = true;
    }

    const run = async (kind: 'add' | 'verify', action: () => Promise<string | null>, result: 'added' | 'confirmed', extraErrors: typeof verifyErrors = {}) => {
        setBusy(kind);
        setError(null);
        try {
            const userId = await action();
            if (userId !== null) {
                LocalStorageStore.setPasskeyEnrolled(userId);
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

    const add = () => run('add', async () => (await createPasskey(
        () => Client4.beginPasskeyEnrollmentRegistration(ticket!),
        (ceremonyId, credential) => Client4.finishPasskeyEnrollmentRegistration(ceremonyId, '', credential),
    ))?.user_id ?? null, 'added');

    const verifyExisting = () => run('verify', async () => (await verifyPasskey(
        () => Client4.beginPasskeyEnrollmentVerification(ticket!),
        (ceremonyId, credential) => Client4.finishPasskeyEnrollmentVerification(ceremonyId, credential),
    ))?.user_id ?? null, 'confirmed', verifyErrors);

    return (
        <ColumnLayout
            title={formatMessage(title)}
            message={message}
            extraContent={(
                <div className='PasskeyEnrollmentPage__actions'>
                    {error && !error.final && (
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
                                {formatMessage(sharedMessages.add)}
                            </Button>
                            <Button
                                emphasis='tertiary'
                                size='large'
                                loading={busy === 'verify'}
                                disabled={busy !== null}
                                onClick={verifyExisting}
                            >
                                {formatMessage(sharedMessages.useExisting)}
                            </Button>
                        </>
                    )}
                </div>
            )}
        />
    );
}
