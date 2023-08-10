// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {checkIfMFARequired} from './route';

import type {ConfigOption} from './route';
import type {ClientLicense} from '@mattermost/types/config';
import type {UserProfile} from '@mattermost/types/users';

describe('Utils.Route', () => {
    describe('checkIfMFARequired', () => {
        test('mfa is enforced', () => {
            const user: UserProfile = {mfa_active: false,
                auth_service: '',
                id: '',
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                username: '',
                password: '',
                email: '',
                nickname: '',
                first_name: '',
                last_name: '',
                position: '',
                roles: '',
                props: {userid: '121'},
                notify_props: {desktop: 'default',
                    desktop_sound: 'false',
                    calls_desktop_sound: 'true',
                    email: 'true',
                    mark_unread: 'all',
                    push: 'default',
                    push_status: 'ooo',
                    comments: 'never',
                    first_name: 'true',
                    channel: 'true',
                    mention_keys: ''},
                last_password_update: 0,
                last_picture_update: 0,
                locale: '',
                timezone: {useAutomaticTimezone: '', automaticTimezone: '', manualTimezone: ''},
                last_activity_at: 0,
                is_bot: false,
                bot_description: '',
                terms_of_service_id: '',
                terms_of_service_create_at: 0,
                remote_id: ''};
            const config: ConfigOption = {EnableMultifactorAuthentication: 'true', EnforceMultifactorAuthentication: 'true'};
            const license: ClientLicense = {MFA: 'true'};

            expect(checkIfMFARequired(user, license, config, '')).toBeTruthy();
            expect(!checkIfMFARequired(user, license, config, '/mfa/setup')).toBeTruthy();
            expect(!checkIfMFARequired(user, license, config, '/mfa/confirm')).toBeTruthy();

            user.auth_service = 'email';
            expect(checkIfMFARequired(user, license, config, '')).toBeTruthy();

            user.auth_service = 'ldap';
            expect(checkIfMFARequired(user, license, config, '')).toBeTruthy();

            user.auth_service = 'saml';
            expect(!checkIfMFARequired(user, license, config, '')).toBeTruthy();

            user.auth_service = '';
            user.mfa_active = true;
            expect(!checkIfMFARequired(user, license, config, '')).toBeTruthy();
        });

        test('mfa is not enforced or enabled', () => {
            const user: UserProfile = {mfa_active: true,
                auth_service: '',
                id: '',
                create_at: 0,
                update_at: 0,
                delete_at: 0,
                username: '',
                password: '',
                email: '',
                nickname: '',
                first_name: '',
                last_name: '',
                position: '',
                roles: '',
                props: {userid: '121'},
                notify_props: {desktop: 'default',
                    desktop_sound: 'false',
                    calls_desktop_sound: 'true',
                    email: 'true',
                    mark_unread: 'all',
                    push: 'default',
                    push_status: 'ooo',
                    comments: 'never',
                    first_name: 'true',
                    channel: 'true',
                    mention_keys: ''},
                last_password_update: 0,
                last_picture_update: 0,
                locale: '',
                timezone: {useAutomaticTimezone: '', automaticTimezone: '', manualTimezone: ''},
                last_activity_at: 0,
                is_bot: false,
                bot_description: '',
                terms_of_service_id: '',
                terms_of_service_create_at: 0,
                remote_id: ''};
            const config: ConfigOption = {EnableMultifactorAuthentication: 'true', EnforceMultifactorAuthentication: 'true'};
            const license: ClientLicense = {MFA: 'true'};
            expect(!checkIfMFARequired(user, license, config, '')).toBeTruthy();

            config.EnforceMultifactorAuthentication = 'true';
            config.EnableMultifactorAuthentication = 'false';
            expect(!checkIfMFARequired(user, license, config, '')).toBeTruthy();

            license.MFA = 'false';
            config.EnableMultifactorAuthentication = 'true';
            expect(!checkIfMFARequired(user, license, config, '')).toBeTruthy();
        });
    });
});
