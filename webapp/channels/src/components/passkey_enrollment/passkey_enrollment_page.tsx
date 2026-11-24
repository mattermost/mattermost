// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useLocation} from 'react-router-dom';

import {Button} from '@mattermost/compass-ui/components/button';
import {isDesktopApp} from '@mattermost/shared/utils/user_agent';

import {Client4} from 'mattermost-redux/client';

import LocalStorageStore from 'stores/local_storage_store';

import ColumnLayout from 'components/header_footer_route/content_layouts/column';

import {createPasskey} from 'utils/passkeys';

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
        defaultMessage: 'This device already has a passkey for your account.',
        description: 'Error shown when the device refuses to create a passkey because it already holds one for the account.',
    },
});

const terminalErrors: Record<string, typeof messages.expired> = {
    'app.passkey.ticket_invalid.app_error': messages.expired,
    'app.passkey.recent_login_required.app_error': messages.expired,
};

export default function PasskeyEnrollmentPage() {
    const {formatMessage} = useIntl();
    const ticket = new URLSearchParams(useLocation().search).get('ticket');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    // A refusal that retrying cannot fix removes the button; any other error leaves it for another try.
    const [error, setError] = useState<{text: string; final: boolean} | null>(null);

    let message;
    let canAdd = false;
    if (isDesktopApp()) {
        message = formatMessage(messages.desktop);
    } else if (typeof window.PublicKeyCredential === 'undefined') {
        message = formatMessage(messages.unsupported);
    } else if (!ticket) {
        message = formatMessage(messages.incomplete);
    } else if (done) {
        message = formatMessage(messages.done);
    } else {
        message = formatMessage(messages.body);
        canAdd = !error?.final;
    }

    const add = async () => {
        setBusy(true);
        setError(null);
        try {
            const passkey = await createPasskey(
                () => Client4.beginPasskeyEnrollmentRegistration(ticket!),
                (ceremonyId, credential) => Client4.finishPasskeyEnrollmentRegistration(ceremonyId, '', credential),
            );
            if (passkey) {
                LocalStorageStore.setPasskeyEnrolled();
                setDone(true);
            }
        } catch (e) {
            const err = e as Error & {server_error_id?: string; status_code?: number};
            if (err.server_error_id && terminalErrors[err.server_error_id]) {
                setError({text: formatMessage(terminalErrors[err.server_error_id]), final: true});
            } else if (err.status_code === 501) {
                setError({text: formatMessage(messages.unavailable), final: true});
            } else if (err.server_error_id === 'app.passkey.ceremony_invalid.app_error') {
                setError({text: formatMessage(messages.tooLong), final: false});
            } else if (err.name === 'InvalidStateError') {
                setError({text: formatMessage(messages.alreadyOnDevice), final: false});
            } else {
                setError({text: err.message, final: false});
            }
        }
        setBusy(false);
    };

    return (
        <ColumnLayout
            title={formatMessage(messages.title)}
            message={message}
            extraContent={(
                <>
                    {error && <div role='alert'>{error.text}</div>}
                    {canAdd && (
                        <Button
                            disabled={busy}
                            onClick={add}
                        >
                            {formatMessage(messages.add)}
                        </Button>
                    )}
                </>
            )}
        />
    );
}
