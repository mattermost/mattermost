// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

// Text shown both by the prompt after sign-in and by the page opened from the Mattermost app.
export const sharedMessages = defineMessages({
    title: {
        id: 'passkey_enrollment.title',
        defaultMessage: 'Add a passkey',
        description: 'Title of the prompt shown after sign-in, and of the page opened from the Mattermost app, that offers to add a passkey.',
    },
    body: {
        id: 'passkey_enrollment.body',
        defaultMessage: 'Sign in with your fingerprint, face or screen lock. A passkey also lets you sign in if your usual sign-in method is unavailable.',
        description: 'Explanation shown in the prompt after sign-in, and on the page opened from the Mattermost app, that offers to add a passkey.',
    },
    add: {
        id: 'passkey_enrollment.add',
        defaultMessage: 'Add passkey',
        description: 'Button, in the prompt after sign-in and on the page opened from the Mattermost app, that starts adding a passkey.',
    },
    useExisting: {
        id: 'passkey_enrollment.useExisting',
        defaultMessage: 'Use existing passkey',
        description: 'Button, in the prompt after sign-in and on the page opened from the Mattermost app, for a user who already has a passkey for this account, for example one synced from another device; it checks the passkey instead of adding a duplicate.',
    },
    noneRegistered: {
        id: 'passkey_enrollment.noneRegistered',
        defaultMessage: 'You don\'t have a passkey for this account yet. Add one instead.',
        description: 'Error shown when the user says they already have a passkey but their account has none.',
    },
    invalidCredential: {
        id: 'passkey_enrollment.invalidCredential',
        defaultMessage: 'That passkey doesn\'t belong to your account on this server. Choose another, or add a new one.',
        description: 'Error shown when the passkey the user chose is not one of their account\'s passkeys.',
    },
});

// The add path returns invalid_credential for an attestation it cannot verify, so this wording is only true for verify.
export const verifyErrors: Record<string, typeof sharedMessages.noneRegistered> = {
    'app.passkey.none_registered.app_error': sharedMessages.noneRegistered,
    'app.passkey.invalid_credential.app_error': sharedMessages.invalidCredential,
};
