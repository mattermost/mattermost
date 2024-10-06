// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createMemoryHistory} from 'history';
import React from 'react';

import {RequestStatus} from 'mattermost-redux/constants';

import LocalStorageStore from 'stores/local_storage_store';

import Login from 'components/login/login';

import mergeObjects from 'packages/mattermost-redux/test/merge_objects';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants, {WindowSizes} from 'utils/constants';

import type {GlobalState} from 'types/store';

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

        screen.getByLabelText('Close').click();

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

        screen.getByLabelText('Close').click();

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
        userEvent.type(emailInput, 'user1');

        const passwordInput = screen.getByLabelText('Password');
        userEvent.type(passwordInput, 'passw');

        screen.getByRole('button', {name: 'Log in'}).click();

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
});
