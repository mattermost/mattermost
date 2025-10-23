// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {RequestStatus} from 'mattermost-redux/constants';

import * as loginActions from 'actions/views/login';
import LocalStorageStore from 'stores/local_storage_store';

import Login from 'components/login/login';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants, {WindowSizes} from 'utils/constants';

import type {GlobalState} from 'types/store';

jest.unmock('react-intl');
jest.unmock('react-router-dom');

describe('components/login/Login', () => {
    const baseState = {
        entities: {
            general: {
                config: {
                    EnableLdap: 'false',
                    EnableSaml: 'false',
                    EnableSignInWithEmail: 'false',
                    EnableSignInWithUsername: 'false',
                    EnableSignUpWithEmail: 'false',
                    EnableSignUpWithGitLab: 'false',
                    EnableSignUpWithOffice365: 'false',
                    EnableSignUpWithGoogle: 'false',
                    EnableSignUpWithOpenId: 'false',
                    EnableOpenServer: 'false',
                    LdapLoginFieldName: '',
                    GitLabButtonText: '',
                    GitLabButtonColor: '',
                    OpenIdButtonText: '',
                    OpenIdButtonColor: '',
                    SamlLoginButtonText: '',
                    EnableCustomBrand: 'false',
                    CustomBrandText: '',
                    CustomDescriptionText: '',
                    SiteName: 'Mattermost',
                    ExperimentalPrimaryTeam: '',
                    PasswordEnableForgotLink: 'true',
                },
                license: {
                    IsLicensed: 'false',
                },
            },
            users: {
                currentUserId: '',
                profiles: {
                    user1: {
                        id: 'user1',
                        roles: '',
                    },
                },
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: {
                        id: 'team1',
                        name: 'team-1',
                        displayName: 'Team 1',
                    },
                },
                myMembers: {
                    team1: {roles: 'team_role'},
                },
            },
        },
        requests: {
            users: {
                logout: {
                    status: RequestStatus.NOT_STARTED,
                },
            },
        },
        storage: {
            initialized: true,
        },
        views: {
            browser: {
                windowSize: WindowSizes.DESKTOP_VIEW,
            },
        },
    } as unknown as GlobalState;

    beforeEach(() => {
        LocalStorageStore.setWasLoggedIn(false);
    });

    it('should match snapshot', () => {
        renderWithContext(
            <Login/>,
            baseState,
        );

        expect(screen.queryByText('This server doesn’t have any sign-in methods enabled')).toBeVisible();
        expect(screen.queryByText('Log in to your account')).not.toBeInTheDocument();
    });

    it('should match snapshot with base login', () => {
        const state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableSignInWithEmail: 'true',
                    },
                },
            },
        });

        renderWithContext(
            <Login/>,
            state,
        );

        expect(screen.queryByText('This server doesn’t have any sign-in methods enabled')).not.toBeInTheDocument();
        expect(screen.queryByText('Log in to your account')).toBeVisible();
    });

    it('should handle session expired', async () => {
        LocalStorageStore.setWasLoggedIn(true);

        const state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableSignInWithEmail: 'true',
                    },
                },
            },
        });

        renderWithContext(
            <Login/>,
            state,
        );

        expect(await screen.findByText('Your session has expired. Please log in again.')).toBeVisible();

        await userEvent.click(screen.getByLabelText('Close'));

        expect(screen.queryByText('Your session has expired. Please log in again.')).not.toBeInTheDocument();
    });

    it('should handle initializing when logout status success', () => {
        const state = mergeObjects(baseState, {
            requests: {
                users: {
                    logout: {
                        status: RequestStatus.SUCCESS,
                    },
                },
            },
        });

        renderWithContext(
            <Login/>,
            state,
        );

        expect(screen.getByText('Loading')).toBeVisible();
    });

    it('should handle initializing when storage not initalized', () => {
        const state = mergeObjects(baseState, {
            storage: {
                initialized: false,
            },
        });

        renderWithContext(
            <Login/>,
            state,
        );

        expect(screen.getByText('Loading')).toBeVisible();
    });

    it('should handle suppress session expired notification on sign in change', async () => {
        LocalStorageStore.setWasLoggedIn(true);

        const history = createMemoryHistory({
            initialEntries: [
                {search: '?extra=' + Constants.SIGNIN_CHANGE},
            ],
        });

        const state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableSignInWithEmail: 'true',
                    },
                },
            },
        });

        renderWithContext(
            <Login/>,
            state,
            {
                history,
            },
        );

        expect(LocalStorageStore.getWasLoggedIn()).toEqual(false);

        expect(await screen.findByText('Sign-in method changed successfully')).toBeVisible();

        await userEvent.click(screen.getByLabelText('Close'));

        expect(screen.queryByText('Sign-in method changed successfully')).not.toBeInTheDocument();
    });

    it('should handle discard session expiry notification on sign in attempt', async () => {
        LocalStorageStore.setWasLoggedIn(true);

        const state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableSignInWithEmail: 'true',
                    },
                },
            },
        });

        renderWithContext(
            <Login/>,
            state,
        );

        expect(await screen.findByText('Your session has expired. Please log in again.')).toBeVisible();

        const emailInput = screen.getByLabelText('Email');
        await userEvent.type(emailInput, 'user1');

        const passwordInput = screen.getByLabelText('Password');
        await userEvent.type(passwordInput, 'passw');

        await userEvent.click(screen.getByRole('button', {name: 'Log in'}));

        expect(screen.queryByText('Your session has expired. Please log in again.')).not.toBeInTheDocument();
    });

    it('should handle gitlab text and color props', () => {
        const state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableSignInWithEmail: 'true',
                        EnableSignUpWithGitLab: 'true',
                        GitLabButtonText: 'GitLab 2',
                        GitLabButtonColor: '#00ff00',
                    },
                },
            },
        });

        renderWithContext(
            <Login/>,
            state,
        );

        const button = screen.getByRole('link', {name: 'Gitlab Icon GitLab 2'});

        expect(button.style).toMatchObject({
            color: 'rgb(0, 255, 0)',
            borderColor: '#00ff00',
        });
    });

    it('should focus username field when there is an error', async () => {
        const state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableSignInWithEmail: 'true',
                    },
                },
            },
        });

        renderWithContext(
            <Login/>,
            state,
            {
                intlMessages: {
                    'login.noEmail': 'Please enter your email',
                },
            },
        );

        // Try to submit without entering username
        await userEvent.click(screen.getByRole('button', {name: 'Log in'}));

        // Verify username field is focused
        const usernameInput = screen.getByLabelText('Email');
        expect(usernameInput).toHaveFocus();
    });

    it('should handle openid text and color props', () => {
        const state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableSignInWithEmail: 'true',
                        EnableSignUpWithOpenId: 'true',
                        OpenIdButtonText: 'OpenID 2',
                        OpenIdButtonColor: '#00ff00',
                    },
                },
            },
        });

        renderWithContext(
            <Login/>,
            state,
        );

        const button = screen.getByRole('link', {name: 'OpenID Icon OpenID 2'});

        expect(button.style).toMatchObject({
            color: 'rgb(0, 255, 0)',
            borderColor: '#00ff00',
        });
    });

    it('should redirect on login', async () => {
        LocalStorageStore.setWasLoggedIn(true);

        const redirectPath = '/boards/team/teamID/boardID';

        const history = createMemoryHistory({
            initialEntries: [
                {search: '?redirect_to=' + redirectPath},
            ],
        });
        history.push = jest.fn().mockImplementation(history.push);

        const state = mergeObjects(baseState, {
            entities: {
                general: {
                    config: {
                        EnableSignInWithEmail: 'true',
                    },
                },
                users: {
                    currentUserId: 'user1',
                },
            },
        });

        renderWithContext(
            <Login/>,
            state,
            {
                history,
            },
        );

        expect(history.push).toHaveBeenCalledWith(redirectPath);
    });

    describe('EnableEasyLogin', () => {
        it('should show password field when EnableEasyLogin is false', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'false',
                        },
                    },
                },
            });

            renderWithContext(
                <Login/>,
                state,
            );

            // Password field should be visible
            expect(screen.getByLabelText('Password')).toBeVisible();
        });

        it('should hide password field initially when EnableEasyLogin is true', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'true',
                        },
                    },
                },
            });

            renderWithContext(
                <Login/>,
                state,
            );

            // Password field should not be visible initially
            expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
        });

        it('should show EasyLoginCard when user login type is easy_login', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'true',
                        },
                    },
                },
            });

            // Mock the getUserLoginType to return 'easy_login'
            const mockGetUserLoginType = jest.fn().mockReturnValue(async () => ({
                data: 'easy_login',
            }));
            jest.spyOn(loginActions, 'getUserLoginType').mockImplementation(mockGetUserLoginType);

            renderWithContext(
                <Login/>,
                state,
            );

            const emailInput = screen.getByLabelText('Email');
            await userEvent.type(emailInput, 'user@example.com');

            await userEvent.click(screen.getByRole('button', {name: 'Log in'}));

            // Should show the easy login success message
            expect(await screen.findByText('We sent you a link to login!')).toBeVisible();
            expect(screen.getByText('Please check your email for the link to login.')).toBeVisible();
            expect(screen.getByText('Your link will expire in 5 minutes.')).toBeVisible();
        });

        it('should show password field when user login type requires password', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'true',
                        },
                    },
                },
            });

            // Mock the getUserLoginType to return empty string (requires password)
            const mockGetUserLoginType = jest.fn().mockReturnValue(async () => ({
                data: '',
            }));
            jest.spyOn(loginActions, 'getUserLoginType').mockImplementation(mockGetUserLoginType);

            renderWithContext(
                <Login/>,
                state,
            );

            const emailInput = screen.getByLabelText('Email');
            await userEvent.type(emailInput, 'user@example.com');

            // Password field should not be visible initially
            expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();

            await userEvent.click(screen.getByRole('button', {name: 'Log in'}));

            // Password field should now be visible
            expect(await screen.findByLabelText('Password')).toBeVisible();
            expect(mockGetUserLoginType).toHaveBeenCalledWith('user@example.com');
        });

        it('should show error when getUserLoginType fails', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'true',
                        },
                    },
                },
            });

            // Mock the getUserLoginType to return an error
            const mockGetUserLoginType = jest.fn().mockReturnValue(async () => ({
                error: {
                    message: 'Network error',
                },
            }));
            jest.spyOn(loginActions, 'getUserLoginType').mockImplementation(mockGetUserLoginType);

            renderWithContext(
                <Login/>,
                state,
            );

            const emailInput = screen.getByLabelText('Email');
            await userEvent.type(emailInput, 'user@example.com');

            await userEvent.click(screen.getByRole('button', {name: 'Log in'}));

            // Should show error message
            expect(await screen.findByText('Network error')).toBeVisible();
        });

        it('should focus password field after it appears when password is required', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'true',
                        },
                    },
                },
            });

            // Mock the getUserLoginType to return empty string (requires password)
            const mockGetUserLoginType = jest.fn().mockReturnValue(async () => ({
                data: '',
            }));
            jest.spyOn(loginActions, 'getUserLoginType').mockImplementation(mockGetUserLoginType);

            renderWithContext(
                <Login/>,
                state,
            );

            const emailInput = screen.getByLabelText('Email');
            await userEvent.type(emailInput, 'user@example.com');

            await userEvent.click(screen.getByRole('button', {name: 'Log in'}));

            // Password field should appear and be focused
            const passwordField = await screen.findByLabelText('Password');
            expect(passwordField).toBeVisible();

            // Wait for focus to be set (setTimeout in the code)
            await new Promise((resolve) => setTimeout(resolve, 150));
            expect(passwordField).toHaveFocus();
        });

        it('should submit with password when password field is shown', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'true',
                        },
                    },
                },
            });

            const mockGetUserLoginType = jest.fn().mockReturnValue(async () => ({
                data: '',
            }));
            jest.spyOn(loginActions, 'getUserLoginType').mockImplementation(mockGetUserLoginType);

            const mockLogin = jest.fn().mockReturnValue(async () => ({
                data: true,
            }));
            jest.spyOn(loginActions, 'login').mockImplementation(mockLogin);

            renderWithContext(
                <Login/>,
                state,
            );

            const emailInput = screen.getByLabelText('Email');
            await userEvent.type(emailInput, 'user@example.com');

            // First submit - triggers getUserLoginType
            await userEvent.click(screen.getByRole('button', {name: 'Log in'}));

            // Password field should appear
            const passwordField = await screen.findByLabelText('Password');
            await userEvent.type(passwordField, 'password123');

            // Second submit - triggers actual login
            await userEvent.click(screen.getByRole('button', {name: 'Log in'}));

            expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123', undefined);
        });

        it('should not show forgot password link when EnableEasyLogin is true and password not required', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'true',
                            PasswordEnableForgotLink: 'true',
                        },
                    },
                },
            });

            renderWithContext(
                <Login/>,
                state,
            );

            // Forgot password link should not be visible when password field is hidden
            expect(screen.queryByText('Forgot your password?')).not.toBeInTheDocument();
        });

        it('should show forgot password link when password field is displayed', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'true',
                            PasswordEnableForgotLink: 'true',
                        },
                    },
                },
            });

            const mockGetUserLoginType = jest.fn().mockReturnValue(async () => ({
                data: '',
            }));
            jest.spyOn(loginActions, 'getUserLoginType').mockImplementation(mockGetUserLoginType);

            renderWithContext(
                <Login/>,
                state,
            );

            const emailInput = screen.getByLabelText('Email');
            await userEvent.type(emailInput, 'user@example.com');

            await userEvent.click(screen.getByRole('button', {name: 'Log in'}));

            // After password field appears, forgot password link should be visible
            await screen.findByLabelText('Password');
            expect(screen.getByText('Forgot your password?')).toBeVisible();
        });

        it('should hide password field when user starts typing in login ID after password field appeared', async () => {
            const state = mergeObjects(baseState, {
                entities: {
                    general: {
                        config: {
                            EnableSignInWithEmail: 'true',
                            EnableEasyLogin: 'true',
                        },
                    },
                },
            });

            // Mock the getUserLoginType to return empty string (requires password)
            const mockGetUserLoginType = jest.fn().mockReturnValue(async () => ({
                data: '',
            }));
            jest.spyOn(loginActions, 'getUserLoginType').mockImplementation(mockGetUserLoginType);

            renderWithContext(
                <Login/>,
                state,
            );

            const emailInput = screen.getByLabelText('Email');
            await userEvent.type(emailInput, 'user@example.com');

            // Click login - password field should appear
            await userEvent.click(screen.getByRole('button', {name: 'Log in'}));
            expect(await screen.findByLabelText('Password')).toBeVisible();

            // User starts typing in the login ID field again
            await userEvent.clear(emailInput);
            await userEvent.type(emailInput, 'different@example.com');

            // Password field should be hidden
            expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
        });
    });
});
