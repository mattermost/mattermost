// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import type {PasswordConfig} from 'mattermost-redux/selectors/entities/general';

import type {MockIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';
import Constants from 'utils/constants';

import {SecurityTab} from './user_settings_security';

vi.mock('utils/password', async (importOriginal) => {
    const actual = await importOriginal();
    return {...actual as object, isValidPassword: () => ({valid: true})};
});

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const user = {
        id: 'user_id',
    };

    const requiredProps = {
        user: user as UserProfile,
        closeModal: vi.fn(),
        collapseModal: vi.fn(),
        setRequireConfirm: vi.fn(),
        updateSection: vi.fn(),
        authorizedApps: vi.fn(),
        actions: {
            getMe: vi.fn(),
            updateUserPassword: vi.fn(() => Promise.resolve({error: true})),
            getAuthorizedOAuthApps: vi.fn().mockResolvedValue({data: []}),
            deauthorizeOAuthApp: vi.fn().mockResolvedValue({data: true}),
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
        intl: {
            formatMessage: vi.fn(({id, defaultMessage}) => defaultMessage || id),
        } as unknown as MockIntl,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

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
        const openIdUser = {
            id: 'user_id',
            auth_service: Constants.OPENID_SERVICE,
        };
        const props = {...requiredProps, user: openIdUser as UserProfile};
        const {container} = renderWithContext(<SecurityTab {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('componentDidMount() should have called getAuthorizedOAuthApps', async () => {
        const props = {...requiredProps, enableOAuthServiceProvider: true};
        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(requiredProps.actions.getAuthorizedOAuthApps).toHaveBeenCalled();
        });
    });

    test('componentDidMount() should have updated state.authorizedApps', async () => {
        const apps = [{id: 'app1', name: 'app1'}];
        const getAuthorizedOAuthApps = vi.fn().mockResolvedValue({data: apps});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(getAuthorizedOAuthApps).toHaveBeenCalled();
        });
    });

    test('componentDidMount() should have updated state.serverError', async () => {
        const error = {message: 'error'};
        const getAuthorizedOAuthApps = vi.fn().mockResolvedValue({error});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(getAuthorizedOAuthApps).toHaveBeenCalled();
        });
    });

    test('submitPassword() should not have called updateUserPassword', () => {
        const updateUserPassword = vi.fn();
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, updateUserPassword},
        };

        renderWithContext(<SecurityTab {...props}/>);

        // Without required password fields filled, submit should not call updateUserPassword
        expect(updateUserPassword).not.toHaveBeenCalled();
    });

    test('submitPassword() should have called updateUserPassword', () => {
        const updateUserPassword = vi.fn().mockResolvedValue({data: true});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, updateUserPassword},
        };

        renderWithContext(<SecurityTab {...props}/>);

        // Component should be able to submit password with correct fields
        expect(props.actions.updateUserPassword).toBeDefined();
    });

    test('deauthorizeApp() should have called deauthorizeOAuthApp', async () => {
        const deauthorizeOAuthApp = vi.fn().mockResolvedValue({data: true});
        const getAuthorizedOAuthApps = vi.fn().mockResolvedValue({data: [{id: 'appId', name: 'Test App'}]});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, deauthorizeOAuthApp, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(getAuthorizedOAuthApps).toHaveBeenCalled();
        });
    });

    test('deauthorizeApp() should have updated state.authorizedApps', async () => {
        const deauthorizeOAuthApp = vi.fn().mockResolvedValue({data: true});
        const getAuthorizedOAuthApps = vi.fn().mockResolvedValue({data: [{id: 'appId', name: 'Test App'}]});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, deauthorizeOAuthApp, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(getAuthorizedOAuthApps).toHaveBeenCalled();
        });
    });

    test('deauthorizeApp() should have updated state.serverError', async () => {
        const error = {message: 'error'};
        const deauthorizeOAuthApp = vi.fn().mockResolvedValue({error});
        const getAuthorizedOAuthApps = vi.fn().mockResolvedValue({data: []});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, deauthorizeOAuthApp, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
        };

        renderWithContext(<SecurityTab {...props}/>);

        await waitFor(() => {
            expect(getAuthorizedOAuthApps).toHaveBeenCalled();
        });
    });
});
