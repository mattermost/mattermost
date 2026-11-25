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

import {createPasskey, currentSessionCanAddPasskey, verifyPasskey} from 'utils/passkeys';
import {isPasskeySession} from 'utils/route';

import {sharedMessages, verifyErrors} from './messages';

import './passkey_enrollment_prompt.scss';

const messages = defineMessages({
    recentLogin: {
        id: 'passkey_enrollment_prompt.recentLoginRequired',
        defaultMessage: 'For your security, sign out and sign back in, then add your passkey within 10 minutes.',
        description: 'Error shown in the passkey prompt when adding a passkey is refused because the user did not sign in recently enough.',
    },
});

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
        currentSessionCanAddPasskey(loginKey).then((canAdd) => {
            if (!canAdd) {
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
                <FormattedMessage {...sharedMessages.title}/>
            }
            showCloseButton={false}
            backdrop='static'
            onHide={skip}
            errorText={error}
            footerContent={
                <>
                    <Button
                        emphasis='tertiary'
                        className='PasskeyEnrollmentPrompt__existing'
                        loading={busy === 'verify'}
                        disabled={busy !== null}
                        onClick={verifyExisting}
                    >
                        <FormattedMessage {...sharedMessages.useExisting}/>
                    </Button>
                    <Button
                        emphasis='tertiary'
                        onClick={skip}
                    >
                        <FormattedMessage
                            id='passkey_enrollment_prompt.notNow'
                            defaultMessage='Not now'
                            description='Button in the post-sign-in passkey prompt that dismisses it until the next sign-in.'
                        />
                    </Button>
                    <Button
                        emphasis='primary'
                        loading={busy === 'add'}
                        disabled={busy !== null}
                        onClick={add}
                    >
                        <FormattedMessage {...sharedMessages.add}/>
                    </Button>
                </>
            }
        >
            <p>
                <FormattedMessage {...sharedMessages.body}/>
            </p>
        </GenericModal>
    );
}
