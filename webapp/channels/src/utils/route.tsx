// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ClientLicense} from '@mattermost/types/config';
import {UserProfile} from '@mattermost/types/users';

import {isGuest} from 'mattermost-redux/utils/user_utils';

import {ErrorPageTypes} from 'utils/constants';

export const notFoundParams = {
    type: ErrorPageTypes.PAGE_NOT_FOUND,
};

const mfaPaths = ['/mfa/setup', '/mfa/confirm'];

const mfaAuthServices = ['', 'email', 'ldap'];

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
        mfaPaths.indexOf(path) === -1
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
