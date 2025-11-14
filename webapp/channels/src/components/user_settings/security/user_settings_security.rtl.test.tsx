// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {IntlShape} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import type {PasswordConfig} from 'mattermost-redux/selectors/entities/general';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import {SecurityTab} from './user_settings_security';

describe('components/user_settings/security/UserSettingsSecurityTab - Auth Service Messages', () => {
    const user = {
        id: 'user_id',
    };

    const baseProps = {
        user: user as UserProfile,
        activeSection: 'password',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        setRequireConfirm: jest.fn(),
        updateSection: jest.fn(),
        actions: {
            getMe: jest.fn(),
            updateUserPassword: jest.fn(() => Promise.resolve({data: true})),
            getAuthorizedOAuthApps: jest.fn().mockResolvedValue({data: []}),
            deauthorizeOAuthApp: jest.fn().mockResolvedValue({data: true}),
        },
        canUseAccessTokens: true,
        enableOAuthServiceProvider: false,
        allowedToSwitchToEmail: true,
        enableSignUpWithGitLab: true,
        enableSignUpWithGoogle: true,
        enableSignUpWithOpenId: true,
        enableLdap: true,
        enableSaml: true,
        enableSignUpWithOffice365: true,
        experimentalEnableAuthenticationTransfer: true,
        passwordConfig: {} as PasswordConfig,
        militaryTime: false,
        intl: {
            formatMessage: jest.fn(({defaultMessage}) => defaultMessage),
        } as unknown as IntlShape,
    };

    describe('Password section auth service messages', () => {
        it('should display GitLab message when user auth_service is gitlab', () => {
            const props = {
                ...baseProps,
                user: {
                    ...user,
                    auth_service: Constants.GITLAB_SERVICE,
                } as UserProfile,
            };

            renderWithContext(<SecurityTab {...props}/>);

            expect(screen.getByText('Login occurs through GitLab. Password cannot be updated.')).toBeInTheDocument();
        });

        it('should display LDAP message when user auth_service is ldap', () => {
            const props = {
                ...baseProps,
                user: {
                    ...user,
                    auth_service: Constants.LDAP_SERVICE,
                } as UserProfile,
            };

            renderWithContext(<SecurityTab {...props}/>);

            expect(screen.getByText('Login occurs through AD/LDAP. Password cannot be updated.')).toBeInTheDocument();
        });

        it('should display SAML message when user auth_service is saml', () => {
            const props = {
                ...baseProps,
                user: {
                    ...user,
                    auth_service: Constants.SAML_SERVICE,
                } as UserProfile,
            };

            renderWithContext(<SecurityTab {...props}/>);

            expect(screen.getByText('This field is handled through your login provider. If you want to change it, you need to do so through your login provider.')).toBeInTheDocument();
        });

        it('should display Google message when user auth_service is google', () => {
            const props = {
                ...baseProps,
                user: {
                    ...user,
                    auth_service: Constants.GOOGLE_SERVICE,
                } as UserProfile,
            };

            renderWithContext(<SecurityTab {...props}/>);

            expect(screen.getByText('Login occurs through Google Apps. Password cannot be updated.')).toBeInTheDocument();
        });

        it('should display Office365 message when user auth_service is office365', () => {
            const props = {
                ...baseProps,
                user: {
                    ...user,
                    auth_service: Constants.OFFICE365_SERVICE,
                } as UserProfile,
            };

            renderWithContext(<SecurityTab {...props}/>);

            expect(screen.getByText('Login occurs through Entra ID. Password cannot be updated.')).toBeInTheDocument();
        });

        it('should display Guest Magic Link message when user auth_service is magic_link', () => {
            const props = {
                ...baseProps,
                user: {
                    ...user,
                    auth_service: Constants.MAGIC_LINK_SERVICE,
                } as UserProfile,
            };

            renderWithContext(<SecurityTab {...props}/>);

            expect(screen.getByText('Login occurs via magic link. Password cannot be updated.')).toBeInTheDocument();
        });

        it('should not display password fields or auth message when user auth_service is openid (unhandled case)', () => {
            const props = {
                ...baseProps,
                user: {
                    ...user,
                    auth_service: Constants.OPENID_SERVICE,
                } as UserProfile,
            };

            renderWithContext(<SecurityTab {...props}/>);

            // OpenID is not explicitly handled in the password section, so it falls through
            // Should not show password input fields
            expect(screen.queryByText('Current Password')).not.toBeInTheDocument();
            expect(screen.queryByText('New Password')).not.toBeInTheDocument();

            // And should not show any of the specific auth service messages
            expect(screen.queryByText('Login occurs through GitLab. Password cannot be updated.')).not.toBeInTheDocument();
            expect(screen.queryByText('Login occurs through Google Apps. Password cannot be updated.')).not.toBeInTheDocument();
        });

        it('should display password input fields when user auth_service is empty (email/password)', () => {
            const props = {
                ...baseProps,
                user: {
                    ...user,
                    auth_service: '',
                } as UserProfile,
            };

            renderWithContext(<SecurityTab {...props}/>);

            // Should show password input fields, not a message
            expect(screen.getByText('Current Password')).toBeInTheDocument();
            expect(screen.getByText('New Password')).toBeInTheDocument();
            expect(screen.getByText('Retype New Password')).toBeInTheDocument();
        });
    });
});

