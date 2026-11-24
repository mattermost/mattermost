// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {GenericModal} from '@mattermost/components';
import {isDesktopApp} from '@mattermost/shared/utils/user_agent';

import {Client4} from 'mattermost-redux/client';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import LocalStorageStore from 'stores/local_storage_store';

import {createPasskey} from 'utils/passkeys';
import {isPasskeySession} from 'utils/route';

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

    // Both are fixed at mount: a skip is recorded against the login that was current when the prompt opened,
    // and nothing that changes afterwards reopens it.
    const [loginKey] = useState(() => Client4.getCSRFFromCookie());
    const [open, setOpen] = useState(() => (
        enrollmentEnabled &&
        !isDesktopApp() &&
        typeof window.PublicKeyCredential !== 'undefined' &&
        !isPasskeySession() &&
        LocalStorageStore.isPasskeyPromptDue(loginKey)
    ));
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    if (!open) {
        return null;
    }

    const skip = () => {
        LocalStorageStore.setPasskeyPromptSkipped(loginKey);
        setOpen(false);
    };

    const add = async () => {
        setAdding(true);
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
        setAdding(false);
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
            isConfirmLoading={adding}
            errorText={error}
        >
            <FormattedMessage
                id='passkey_enrollment_prompt.body'
                defaultMessage='Sign in with your fingerprint, face or screen lock. A passkey also lets you sign in if your usual sign-in method is unavailable.'
                description='Body of the prompt shown after sign-in that offers to add a passkey.'
            />
        </GenericModal>
    );
}
