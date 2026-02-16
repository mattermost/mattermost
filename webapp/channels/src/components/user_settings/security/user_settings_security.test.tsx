// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {UserProfile} from '@mattermost/types/users';

import type {PasswordConfig} from 'mattermost-redux/selectors/entities/general';

import {renderWithContext, screen, userEvent, waitFor, fireEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';

import SecurityTab from './user_settings_security';

jest.mock('utils/password', () => {
    const original = jest.requireActual('utils/password');
    return {...original, isValidPassword: () => ({valid: true})};
});

jest.mock('./mfa_section', () => () => <div data-testid='mfa-section'/>);
jest.mock('./user_access_token_section', () => () => <div data-testid='tokens-section'/>);

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const user = {
        id: 'user_id',
        auth_service: '',
        last_password_update: 1234567890000,
    };

    const requiredProps = {
        user: user as UserProfile,
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        setRequireConfirm: jest.fn(),
        updateSection: jest.fn(),
        authorizedApps: jest.fn(),
        actions: {
            getMe: jest.fn(),
            updateUserPassword: jest.fn(() => Promise.resolve({error: true})),
            getAuthorizedOAuthApps: jest.fn().mockResolvedValue({data: []}),
            deauthorizeOAuthApp: jest.fn().mockResolvedValue({data: true}),
        },
        canUseAccessTokens: true,
        enableOAuthServiceProvider: false,
        allowedToSwitchToEmail: true,
        enableSignUpWithGitLab: false,
        enableSignUpWithGoogle: true,
        enableSignUpWithOpenId: false,
        enableLdap: false,
        enableSaml: true,
        enableSignUpWithOffice365: false,
        experimentalEnableAuthenticationTransfer: true,
        passwordConfig: {} as PasswordConfig,
        militaryTime: false,
    };

    test('should match snapshot, enable google', () => {
        const props = {...requiredProps, enableSaml: false};

        const {container} = renderWithContext(<SecurityTab {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, enable gitlab', () => {
        const props = {...requiredProps, enableSignUpWithGoogle: false, enableSaml: false, enableSignUpWithGitLab: true};

        const {container} = renderWithContext(<SecurityTab {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, enable office365', () => {
        const props = {...requiredProps, enableSignUpWithGoogle: false, enableSaml: false, enableSignUpWithOffice365: true};

        const {container} = renderWithContext(<SecurityTab {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, enable openID', () => {
        const props = {...requiredProps, enableSignUpWithGoogle: false, enableSaml: false, enableSignUpWithOpenId: true};

        const {container} = renderWithContext(<SecurityTab {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, to email', () => {
        const user = {
            id: 'user_id',
            auth_service: Constants.OPENID_SERVICE,
        };

        const props = {...requiredProps, user: user as UserProfile};

        const {container} = renderWithContext(<SecurityTab {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('componentDidMount() should have called getAuthorizedOAuthApps', () => {
        const props = {...requiredProps, enableOAuthServiceProvider: true};

        renderWithContext(<SecurityTab {...props}/>);

        expect(requiredProps.actions.getAuthorizedOAuthApps).toHaveBeenCalled();
    });

    test('componentDidMount() should have updated state.authorizedApps', async () => {
        const apps = [{id: 'app1', name: 'app1'}];
        const getAuthorizedOAuthApps = jest.fn().mockResolvedValue({data: apps});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
            activeSection: 'apps',
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('app1')).toBeInTheDocument();
        });
    });

    test('componentDidMount() should have updated state.serverError', async () => {
        const error = {message: 'error'};
        const getAuthorizedOAuthApps = jest.fn().mockResolvedValue({error});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
            activeSection: 'apps',
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('error')).toBeInTheDocument();
        });
    });

    test('submitPassword() should not have called updateUserPassword', () => {
        const props = {
            ...requiredProps,
            activeSection: 'password',
        };

        renderWithContext(<SecurityTab {...props}/>);

        // Save button is disabled because fields are empty (isValid is false)
        const saveButton = screen.getByText('Save');
        fireEvent.click(saveButton);

        expect(requiredProps.actions.updateUserPassword).toHaveBeenCalledTimes(0);
    });

    test('submitPassword() should have called updateUserPassword', async () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: true}));
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, updateUserPassword},
            activeSection: 'password',
        };

        renderWithContext(<SecurityTab {...props}/>);

        const password = 'psw';

        await userEvent.type(screen.getByLabelText('Current Password'), 'currentPassword');
        await userEvent.type(screen.getByLabelText('New Password'), password);
        await userEvent.type(screen.getByLabelText('Retype New Password'), password);

        await userEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(updateUserPassword).toHaveBeenCalled();
        });
        expect(updateUserPassword).toHaveBeenCalledWith(
            user.id,
            'currentPassword',
            password,
        );

        expect(requiredProps.updateSection).toHaveBeenCalled();
        expect(requiredProps.updateSection).toHaveBeenCalledWith('');
    });

    test('deauthorizeApp() should have called deauthorizeOAuthApp', async () => {
        const appId = 'appId';
        const apps = [{id: appId, name: 'TestApp', homepage: 'http://test.com', description: 'test', icon_url: ''}] as OAuthApp[];
        const getAuthorizedOAuthApps = jest.fn().mockResolvedValue({data: apps});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
            activeSection: 'apps',
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Deauthorize')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Deauthorize'));

        expect(requiredProps.actions.deauthorizeOAuthApp).toHaveBeenCalled();
        expect(requiredProps.actions.deauthorizeOAuthApp).toHaveBeenCalledWith(
            appId,
        );
    });

    test('deauthorizeApp() should have updated state.authorizedApps', async () => {
        const appId = 'appId';
        const apps = [{id: appId, name: 'App1', homepage: 'http://test.com', description: '', icon_url: ''}, {id: '2', name: 'App2', homepage: 'http://test2.com', description: '', icon_url: ''}] as OAuthApp[];
        const deauthorizeOAuthApp = jest.fn().mockResolvedValue({data: true});
        const getAuthorizedOAuthApps = jest.fn().mockResolvedValue({data: apps});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, deauthorizeOAuthApp, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
            activeSection: 'apps',
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(screen.getAllByText('Deauthorize')).toHaveLength(2);
        });

        await userEvent.click(screen.getAllByText('Deauthorize')[0]);

        await waitFor(() => {
            expect(screen.queryByText('App1')).not.toBeInTheDocument();
        });
        expect(screen.getByText('App2')).toBeInTheDocument();
    });

    test('deauthorizeApp() should have updated state.serverError', async () => {
        const appId = 'appId';
        const apps = [{id: appId, name: 'TestApp', homepage: 'http://test.com', description: '', icon_url: ''}] as OAuthApp[];
        const error = {message: 'error'};
        const deauthorizeOAuthApp = jest.fn().mockResolvedValue({error});
        const getAuthorizedOAuthApps = jest.fn().mockResolvedValue({data: apps});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, deauthorizeOAuthApp, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
            activeSection: 'apps',
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(screen.getByText('Deauthorize')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Deauthorize'));

        await waitFor(() => {
            expect(screen.getByText('error')).toBeInTheDocument();
        });
    });
});
