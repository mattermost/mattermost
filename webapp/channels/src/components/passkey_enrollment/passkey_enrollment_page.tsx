// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useHistory, useLocation} from 'react-router-dom';

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
    signInAgainToAdd: {
        id: 'passkey_enrollment_page.signInAgainToAdd',
        defaultMessage: 'To add a passkey, return to the app and sign in again. You can still use a passkey you already have.',
        description: 'Error shown when the page, opened from the Mattermost app, loads with a session that signed in too long ago to add a passkey. The user can still confirm a passkey they already have.',
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
    account: {
        id: 'passkey_enrollment_page.account',
        defaultMessage: 'This adds a passkey to the account <b>{username}</b>. If that isn\'t your account, close this page.',
        description: 'Shown on the passkey enrollment page, opened from the Mattermost app, naming the account the passkey will be added to so the user can notice a link meant for someone else. {username} is that account\'s username.',
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

    // The fragment is never sent to the server, so the ticket stays out of access logs. It is read once and then
    // dropped from the address bar, so it doesn't linger in the tab's history or get copied from the URL.
    const history = useHistory();
    const location = useLocation();
    const [ticket] = useState(() => new URLSearchParams(location.hash.slice(1)).get('ticket'));
    useEffect(() => {
        // replace, not push, so Back doesn't bring the ticket back
        if (history.location.hash) {
            history.replace({...history.location, hash: ''});
        }
    }, [history]);
    const [busy, setBusy] = useState<'add' | 'verify' | null>(null);
    const [done, setDone] = useState<'added' | 'confirmed' | null>(null);

    // The account the ticket belongs to, learned from the server; the buttons wait until that has settled.
    const [username, setUsername] = useState<string | null>(null);
    const [loaded, setLoaded] = useState(false);

    // Only Add needs a recent sign-in; confirming an existing passkey doesn't, so it stays available.
    const [addBlocked, setAddBlocked] = useState(false);

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

        // The status element persists from the can-act branch, because a live region inserted with its text is often not announced.
        message = (
            <span role='status'>
                <span className='sr-only'>{formatMessage(title)}{'. '}</span>
                <span>{formatMessage(messages.returnToApp)}</span>
            </span>
        );
    } else if (error?.final) {
        title = messages.cantAdd;

        // Final errors get no banner (which carries the alert role), so the subtitle announces the refusal itself.
        message = <span role='alert'>{error.text}</span>;
    } else {
        message = (
            <span role='status'>
                {formatMessage(sharedMessages.body)}
                {username && ' '}
                {username && formatMessage(messages.account, {username, b: (chunks) => <b>{chunks}</b>})}
            </span>
        );
        canAct = loaded;
    }

    const showError = (e: unknown, extraErrors: typeof verifyErrors = {}) => {
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
    };

    // Begin does not spend the ticket. It runs here only to learn the username; Add begins its own ceremony, because
    // the browser's timer starts at create() while the server's starts at begin, so a reused one could expire mid-biometric.
    const canStart = Boolean(ticket) && !isDesktopApp() && typeof window.PublicKeyCredential !== 'undefined';
    useEffect(() => {
        if (!canStart) {
            return undefined;
        }
        let cancelled = false;
        Client4.beginPasskeyEnrollmentRegistration(ticket!).then(
            (begin) => !cancelled && setUsername(begin.options.publicKey.user.name),
            (e) => {
                if (cancelled) {
                    return;
                }
                if ((e as {server_error_id?: string}).server_error_id === 'app.passkey.recent_login_required.app_error') {
                    setAddBlocked(true);
                    setError({text: formatMessage(messages.signInAgainToAdd), final: false});
                } else {
                    showError(e);
                }
            },
        ).finally(() => !cancelled && setLoaded(true));
        return () => {
            cancelled = true;
        };

        // Once per page load: the ticket never changes and showError only reads render-time values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            showError(e, extraErrors);
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
                            {!addBlocked && (
                                <Button
                                    emphasis='primary'
                                    size='large'
                                    loading={busy === 'add'}
                                    disabled={busy !== null}
                                    onClick={add}
                                >
                                    {formatMessage(sharedMessages.add)}
                                </Button>
                            )}
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
