// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ClientLicense} from '@mattermost/types/config';
import type {UserProfile} from '@mattermost/types/users';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import {ErrorPageTypes} from 'utils/constants';

export const notFoundParams = {
    type: ErrorPageTypes.PAGE_NOT_FOUND,
};

const mfaPaths = ['/mfa/setup', '/mfa/confirm'];

const mfaAuthServices = ['', 'email', 'ldap'];

// Only decides where to navigate; the server enforces MFA from the session. The server expires
// this cookie on every non-passkey sign-in, so a stale one is overwritten by the next sign-in.
export function isPasskeySession() {
    return document.cookie.split(';').some((c) => c.trim() === 'MMLOGINMETHOD=passkey');
}

export type ConfigOption = {
    EnableMultifactorAuthentication?: string;
    EnforceMultifactorAuthentication?: string;
    GuestAccountsEnforceMultifactorAuthentication?: string;
};

export function checkIfMFARequired(
    user: UserProfile | undefined,
    license: ClientLicense,
    config: ConfigOption,
    path: string,
): boolean {
    if (
        license.MFA === 'true' &&
        config.EnableMultifactorAuthentication === 'true' &&
        config.EnforceMultifactorAuthentication === 'true' &&
        mfaPaths.indexOf(path) === -1 &&
        !isPasskeySession()
    ) {
        if (
            user &&
            isGuest(user.roles) &&
            config.GuestAccountsEnforceMultifactorAuthentication !== 'true'
        ) {
            return false;
        }
        if (
            user &&
            !user.mfa_active &&
            mfaAuthServices.indexOf(user.auth_service) !== -1
        ) {
            return true;
        }
    }
    return false;
}
