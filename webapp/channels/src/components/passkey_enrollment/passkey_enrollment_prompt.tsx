// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {Button} from '@mattermost/compass-ui/components/button';
import {GenericModal} from '@mattermost/components';
import {isDesktopApp} from '@mattermost/shared/utils/user_agent';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import LocalStorageStore from 'stores/local_storage_store';

import {createPasskey, verifyPasskey} from 'utils/passkeys';
import {isPasskeySession} from 'utils/route';

const messages = defineMessages({
    recentLogin: {
        id: 'passkey_enrollment_prompt.recentLoginRequired',
        defaultMessage: 'For your security, sign out and sign back in, then add your passkey within 10 minutes.',
        description: 'Error shown in the passkey prompt when adding a passkey is refused because the user did not sign in recently enough.',
    },
    noneRegistered: {
        id: 'passkey_enrollment_prompt.noneRegistered',
        defaultMessage: 'You don\'t have a passkey for this account yet. Add one instead.',
        description: 'Error shown in the passkey prompt when the user says they already have a passkey but their account has none.',
    },
    invalidCredential: {
        id: 'passkey_enrollment_prompt.invalidCredential',
        defaultMessage: 'That passkey doesn\'t belong to your account on this server. Choose another, or add a new one.',
        description: 'Error shown in the passkey prompt when the passkey the user chose is not one of their account\'s passkeys.',
    },
});

// The server's recent-login window for adding a passkey.
const RECENT_LOGIN_WINDOW_MS = 10 * 60 * 1000;

const verifyErrors: Record<string, typeof messages.noneRegistered> = {
    'app.passkey.none_registered.app_error': messages.noneRegistered,
    'app.passkey.invalid_credential.app_error': messages.invalidCredential,
};

export default function PasskeyEnrollmentPrompt() {
    const {formatMessage} = useIntl();
    const enrollmentEnabled = useSelector(getConfig).PasskeyEnrollmentEnabled === 'true';

    // Fixed at mount: a skip is recorded against the login that was current when the prompt opened, and
    // nothing that changes afterwards reopens it.
    const [loginKey] = useState(() => Client4.getCSRFFromCookie());
    const [eligible] = useState(() => (
        enrollmentEnabled &&
        !isDesktopApp() &&
        typeof window.PublicKeyCredential !== 'undefined' &&
        !isPasskeySession() &&
        LocalStorageStore.isPasskeyPromptDue(loginKey)
    ));
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState<'add' | 'verify' | null>(null);
    const [error, setError] = useState('');

    // Open only for the session this sign-in started: the cookie cannot say how or when it began, and
    // without a recent standard sign-in the server would refuse "Add passkey" anyway.
    useEffect(() => {
        if (!eligible) {
            return undefined;
        }
        let cancelled = false;
        Client4.getSessions('me').then((sessions) => {
            const current = sessions.find((s) => s.props?.csrf === loginKey);

            // The list comes from a read replica, so a session created moments ago may be missing from
            // it. This request is authenticated by that session, so a missing one is treated as recent;
            // `eligible` has already ruled out passkey sessions.
            if (current && (current.props.login_method !== 'standard' || Date.now() - current.create_at > RECENT_LOGIN_WINDOW_MS)) {
                // It can never become eligible; skip so later mounts in this sign-in do not ask again.
                LocalStorageStore.setPasskeyPromptSkipped(loginKey);
            } else if (!cancelled) {
                setOpen(true);
            }
        }, () => {
            // A failed lookup leaves the prompt closed; it is only an offer.
        });
        return () => {
            cancelled = true;
        };
    }, [eligible, loginKey]);

    if (!open) {
        return null;
    }

    const skip = () => {
        LocalStorageStore.setPasskeyPromptSkipped(loginKey);
        setOpen(false);
    };

    const add = async () => {
        setBusy('add');
        setError('');
        try {
            const passkey = await createPasskey(
                () => Client4.beginPasskeyRegistration('me'),
                (ceremonyId, credential) => Client4.finishPasskeyRegistration('me', ceremonyId, '', credential),
            );
            if (passkey) {
                LocalStorageStore.setPasskeyEnrolled();
                setOpen(false);
                return;
            }
        } catch (e) {
            const err = e as Error & {server_error_id?: string};

            // The authenticator already holds one of this account's passkeys, e.g. after the local record was cleared.
            if (err.name === 'InvalidStateError') {
                LocalStorageStore.setPasskeyEnrolled();
                setOpen(false);
                return;
            }
            setError(err.server_error_id === 'app.passkey.recent_login_required.app_error' ? formatMessage(messages.recentLogin) : err.message);
        }
        setBusy(null);
    };

    const verifyExisting = async () => {
        setBusy('verify');
        setError('');
        try {
            // One ticket per attempt: a successful check spends it.
            const {ticket} = await Client4.createPasskeyEnrollmentTicket('me');
            const verified = await verifyPasskey(
                () => Client4.beginPasskeyEnrollmentVerification(ticket),
                (ceremonyId, credential) => Client4.finishPasskeyEnrollmentVerification(ceremonyId, credential),
            );
            if (verified) {
                LocalStorageStore.setPasskeyEnrolled();
                setOpen(false);
                return;
            }
        } catch (e) {
            const err = e as Error & {server_error_id?: string};
            const known = err.server_error_id && verifyErrors[err.server_error_id];
            setError(known ? formatMessage(known) : err.message);
        }
        setBusy(null);
    };

    return (
        <GenericModal
            compassDesign={true}
            modalHeaderText={
                <FormattedMessage
                    id='passkey_enrollment_prompt.title'
                    defaultMessage='Add a passkey'
                    description='Title of the prompt shown after sign-in that offers to add a passkey.'
                />
            }
            confirmButtonText={
                <FormattedMessage
                    id='passkey_enrollment_prompt.add'
                    defaultMessage='Add passkey'
                    description='Button in the post-sign-in prompt that starts adding a passkey.'
                />
            }
            cancelButtonText={
                <FormattedMessage
                    id='passkey_enrollment_prompt.notNow'
                    defaultMessage='Not now'
                    description='Button in the post-sign-in passkey prompt that dismisses it until the next sign-in.'
                />
            }
            handleConfirm={add}
            handleCancel={skip}
            autoCloseOnConfirmButton={false}
            autoCloseOnCancelButton={false}
            onHide={skip}
            isConfirmLoading={busy === 'add'}
            isConfirmDisabled={busy !== null}
            errorText={error}
        >
            <FormattedMessage
                id='passkey_enrollment_prompt.body'
                defaultMessage='Sign in with your fingerprint, face or screen lock. A passkey also lets you sign in if your usual sign-in method is unavailable.'
                description='Body of the prompt shown after sign-in that offers to add a passkey.'
            />
            <div>
                <Button
                    emphasis='tertiary'
                    disabled={busy !== null}
                    onClick={verifyExisting}
                >
                    <FormattedMessage
                        id='passkey_enrollment_prompt.alreadyHave'
                        defaultMessage='I already have a passkey'
                        description='Button in the post-sign-in passkey prompt for a user who already has a passkey for this account, for example one synced from another device; it checks the passkey instead of adding a duplicate.'
                    />
                </Button>
            </div>
        </GenericModal>
    );
}
