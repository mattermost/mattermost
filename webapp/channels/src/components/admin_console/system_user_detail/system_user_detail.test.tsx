// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import '@testing-library/jest-dom';

import {fireEvent, screen} from '@testing-library/react';
import React from 'react';
import type {IntlShape} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import type {UserProfile} from '@mattermost/types/users';

import SystemUserDetail, {getUserAuthenticationTextField} from 'components/admin_console/system_user_detail/system_user_detail';
import type {Params, Props} from 'components/admin_console/system_user_detail/system_user_detail';

import type {MockIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, waitFor, within} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

// Mock user profile data
const user = Object.assign(TestHelper.getUserMock(), {auth_service: Constants.EMAIL_SERVICE}) as UserProfile;
const ldapUser = {...user, auth_service: Constants.LDAP_SERVICE} as UserProfile;

// Mock getUser action result
const getUserMock = jest.fn().mockResolvedValue({data: user, error: null});
const getLdapUserMock = jest.fn().mockResolvedValue({data: ldapUser, error: null});

describe('SystemUserDetail', () => {
    const defaultProps: Props = {
        showManageUserSettings: false,
        showLockedManageUserSettings: false,
        mfaEnabled: false,
        patchUser: jest.fn(),
        updateUserAuth: jest.fn(),
        updateUserMfa: jest.fn(),
        getUser: getUserMock,
        updateUserActive: jest.fn(),
        setNavigationBlocked: jest.fn(),
        addUserToTeam: jest.fn(),
        openModal: jest.fn(),
        getUserPreferences: jest.fn(),
        intl: {
            formatMessage: jest.fn(),
        } as MockIntl,
        ...({
            match: {
                params: {
                    user_id: 'user_id',
                },
            },
        } as RouteComponentProps<Params>),
    };

    const waitForLoadingToFinish = async (container: HTMLElement) => {
        const noUserBody = container.querySelector('.noUserBody');
        const spinner = within(noUserBody as HTMLElement).getByTestId('loadingSpinner');
        expect(spinner).toBeInTheDocument();

        await waitFor(() => {
            expect(container.querySelector('[data-testid="loadingSpinner"]')).not.toBeInTheDocument();
        });
    };

    test('should match default snapshot', async () => {
        const props = defaultProps;
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish(container);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if MFA is enabled', async () => {
        const props = {
            ...defaultProps,
            mfaEnabled: true,
        };
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish(container);

        expect(container).toMatchSnapshot();
    });

    test('should show manage user settings button as activated', async () => {
        const props = {
            ...defaultProps,
            showManageUserSettings: true,
        };
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish(container);

        expect(container).toMatchSnapshot();
    });

    test('should show manage user settings button as disabled when no license', async () => {
        const props = {
            ...defaultProps,
            showLockedManageUserSettings: false,
        };
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish(container);

        expect(container).toMatchSnapshot();
    });

    test('should show the activate user button as disabled when user is LDAP', async () => {
        const props = {
            ...defaultProps,
            getUser: getLdapUserMock,
            isLoading: false,
        };

        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish(container);

        const activateButton = container.querySelector('button[disabled]');
        expect(activateButton).toHaveTextContent('Deactivate (Managed By LDAP)');

        expect(container).toMatchSnapshot();
    });

    test('should not show manage user settings button when user doesn\'t have permission', async () => {
        const props = {
            ...defaultProps,
            showManageUserSettings: false,
        };
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish(container);

        expect(container).toMatchSnapshot();
    });

    describe('change detection', () => {
        test('should detect email changes and enable save', async () => {
            const setNavigationBlockedMock = jest.fn();
            const props = {
                ...defaultProps,
                setNavigationBlocked: setNavigationBlockedMock,
                intl: {
                    formatMessage: jest.fn().mockImplementation(({defaultMessage}) => defaultMessage),
                } as MockIntl,
            };
            renderWithContext(<SystemUserDetail {...props}/>);

            await waitFor(() => {
                expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
            });

            const emailInputs = screen.getAllByDisplayValue(user.email);
            const emailInput = emailInputs.find((input) => !(input as HTMLInputElement).disabled);

            if (emailInput) {
                fireEvent.change(emailInput, {target: {value: 'newemail@example.com'}});
                expect(setNavigationBlockedMock).toHaveBeenCalledWith(true);
            }
        });

        test('should detect username changes and enable save', async () => {
            const setNavigationBlockedMock = jest.fn();
            const props = {
                ...defaultProps,
                setNavigationBlocked: setNavigationBlockedMock,
                intl: {
                    formatMessage: jest.fn().mockImplementation(({defaultMessage}) => defaultMessage),
                } as MockIntl,
            };
            renderWithContext(<SystemUserDetail {...props}/>);

            await waitFor(() => {
                expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
            });

            const usernameInputs = screen.getAllByDisplayValue(user.username);
            const usernameInput = usernameInputs.find((input) => !(input as HTMLInputElement).disabled);

            if (usernameInput) {
                fireEvent.change(usernameInput, {target: {value: 'newusername'}});
                expect(setNavigationBlockedMock).toHaveBeenCalledWith(true);
            }
        });
    });

    describe('email validation', () => {
        test('should handle email validation and still set navigation blocking', async () => {
            const setNavigationBlockedMock = jest.fn();
            const props = {
                ...defaultProps,
                setNavigationBlocked: setNavigationBlockedMock,
                intl: {
                    formatMessage: jest.fn().mockImplementation(({defaultMessage}) => defaultMessage),
                } as MockIntl,
            };
            renderWithContext(<SystemUserDetail {...props}/>);

            await waitFor(() => {
                expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
            });

            const emailInputs = screen.getAllByDisplayValue(user.email);
            const emailInput = emailInputs.find((input) => !(input as HTMLInputElement).disabled);

            if (emailInput) {
                fireEvent.change(emailInput, {target: {value: 'invalid-email'}});

                // Navigation should still be blocked even with invalid email
                expect(setNavigationBlockedMock).toHaveBeenCalledWith(true);
            }
        });

        test('should not show validation error for valid email', async () => {
            const props = {
                ...defaultProps,
                intl: {
                    formatMessage: jest.fn().mockImplementation(({defaultMessage}) => defaultMessage),
                } as MockIntl,
            };
            renderWithContext(<SystemUserDetail {...props}/>);

            await waitFor(() => {
                expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
            });

            const emailInputs = screen.getAllByDisplayValue(user.email);
            const emailInput = emailInputs.find((input) => !(input as HTMLInputElement).disabled);

            if (emailInput) {
                fireEvent.change(emailInput, {target: {value: 'valid@email.com'}});

                await waitFor(() => {
                    expect(screen.queryByText('Invalid email address')).not.toBeInTheDocument();
                });
            }
        });
    });

    describe('username validation', () => {
        test('should show validation error for empty username', async () => {
            const props = {
                ...defaultProps,
                intl: {
                    formatMessage: jest.fn().mockImplementation(({defaultMessage}) => defaultMessage),
                } as MockIntl,
            };
            renderWithContext(<SystemUserDetail {...props}/>);

            await waitFor(() => {
                expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
            });

            const usernameInputs = screen.getAllByDisplayValue(user.username);
            const usernameInput = usernameInputs.find((input) => !(input as HTMLInputElement).disabled);

            if (usernameInput) {
                fireEvent.change(usernameInput, {target: {value: '  '}});

                await waitFor(() => {
                    expect(screen.getByText('Username cannot be empty')).toBeInTheDocument();
                });
            }
        });
    });

    describe('error handling', () => {
        test('should handle getUser error correctly', async () => {
            // Suppress expected console errors
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

            const getUserErrorMock = jest.fn().mockResolvedValue({
                data: null,
                error: {message: 'User not found'},
            });

            const props = {
                ...defaultProps,
                getUser: getUserErrorMock,
                intl: {
                    formatMessage: jest.fn().mockImplementation(({defaultMessage}) => defaultMessage),
                } as MockIntl,
            };

            renderWithContext(<SystemUserDetail {...props}/>);

            await waitFor(() => {
                expect(screen.getByText('Cannot load User')).toBeInTheDocument();
            });

            consoleSpy.mockRestore();
        });

        test('should handle updateUserActive error correctly', async () => {
            // Suppress expected console errors
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const updateUserActiveMock = jest.fn().mockResolvedValue({
                data: null,
                error: {message: 'Activation failed'},
            });
            const getUserDeactivatedMock = jest.fn().mockResolvedValue({
                data: {...user, delete_at: 123456789}, // Deactivated user
                error: null,
            });

            const props = {
                ...defaultProps,
                getUser: getUserDeactivatedMock,
                updateUserActive: updateUserActiveMock,
                intl: {
                    formatMessage: jest.fn().mockImplementation(({defaultMessage}) => defaultMessage),
                } as MockIntl,
            };

            renderWithContext(<SystemUserDetail {...props}/>);

            await waitFor(() => {
                expect(screen.queryByTestId('loadingSpinner')).not.toBeInTheDocument();
            });

            // Find and click activate button
            const activateButton = screen.getByText('Activate');
            fireEvent.click(activateButton);

            await waitFor(() => {
                expect(screen.getByText('Activation failed')).toBeInTheDocument();
            });

            consoleSpy.mockRestore();
        });
    });
});

describe('getUserAuthenticationTextField', () => {
    const intl = {formatMessage: ({defaultMessage}: {defaultMessage: string}) => defaultMessage} as IntlShape;

    it('should return empty string if user is not provided', () => {
        const result = getUserAuthenticationTextField(intl, false, undefined);
        expect(result).toEqual('');
    });

    it('should return email if user has no auth service and MFA is not enabled', () => {
        const result = getUserAuthenticationTextField(intl, false, {auth_service: '', mfa_active: false} as UserProfile);
        expect(result).toEqual('Email');
    });

    it('should return auth service in uppercase if it is LDAP or SAML', () => {
        const result = getUserAuthenticationTextField(intl, false, {auth_service: 'ldap', mfa_active: false} as UserProfile);
        expect(result).toEqual('LDAP');
    });

    it('should return auth service in title case if it is not LDAP or SAML', () => {
        const result = getUserAuthenticationTextField(intl, true, {auth_service: 'oauth', mfa_active: false} as UserProfile);
        expect(result).toEqual('Oauth');
    });

    it('should include MFA if user has MFA enabled', () => {
        const result = getUserAuthenticationTextField(intl, true, {auth_service: 'oauth', mfa_active: true} as UserProfile);
        expect(result).toEqual('Oauth, MFA');
    });
});
