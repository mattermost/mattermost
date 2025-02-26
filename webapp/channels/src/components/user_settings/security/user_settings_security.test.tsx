// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {OAuthApp} from '@mattermost/types/integrations';
import type {UserProfile} from '@mattermost/types/users';

import type {PasswordConfig} from 'mattermost-redux/selectors/entities/general';

import type {MockIntl} from 'tests/helpers/intl-test-helper';
import Constants from 'utils/constants';

import {SecurityTab} from './user_settings_security';

jest.mock('utils/password', () => {
    const original = jest.requireActual('utils/password');
    return {...original, isValidPassword: () => ({valid: true})};
});

describe('components/user_settings/display/UserSettingsDisplay', () => {
    const user = {
        id: 'user_id',
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
        intl: {
            formatMessage: jest.fn(({id, defaultMessage}) => defaultMessage || id),
        } as MockIntl,
    };

    test('should match snapshot, enable google', () => {
        const props = {...requiredProps, enableSaml: false};

        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, enable gitlab', () => {
        const props = {...requiredProps, enableSignUpWithGoogle: false, enableSaml: false, enableSignUpWithGitLab: true};

        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, enable office365', () => {
        const props = {...requiredProps, enableSignUpWithGoogle: false, enableSaml: false, enableSignUpWithOffice365: true};

        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, enable openID', () => {
        const props = {...requiredProps, enableSignUpWithGoogle: false, enableSaml: false, enableSignUpWithOpenId: true};

        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, to email', () => {
        const user = {
            id: 'user_id',
            auth_service: Constants.OPENID_SERVICE,
        };

        const props = {...requiredProps, user: user as UserProfile};

        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('componentDidMount() should have called getAuthorizedOAuthApps', () => {
        const props = {...requiredProps, enableOAuthServiceProvider: true};

        shallow<SecurityTab>(<SecurityTab {...props}/>);

        expect(requiredProps.actions.getAuthorizedOAuthApps).toHaveBeenCalled();
    });

    test('componentDidMount() should have updated state.authorizedApps', async () => {
        const apps = [{name: 'app1'}];
        const promise = Promise.resolve({data: apps});
        const getAuthorizedOAuthApps = () => promise;
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
        };

        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);

        await promise;

        expect(wrapper.state().authorizedApps).toEqual(apps);
    });

    test('componentDidMount() should have updated state.serverError', async () => {
        const error = {message: 'error'};
        const promise = Promise.resolve({error});
        const getAuthorizedOAuthApps = () => promise;
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, getAuthorizedOAuthApps},
            enableOAuthServiceProvider: true,
        };

        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);

        await promise;

        expect(wrapper.state('serverError')).toEqual(error.message);
    });

    test('submitPassword() should not have called updateUserPassword', async () => {
        const wrapper = shallow<SecurityTab>(<SecurityTab {...requiredProps}/>);

        await wrapper.instance().submitPassword();
        expect(requiredProps.actions.updateUserPassword).toHaveBeenCalledTimes(0);
    });

    test('submitPassword() should have called updateUserPassword', async () => {
        const updateUserPassword = jest.fn(() => Promise.resolve({data: true}));
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, updateUserPassword},
        };
        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);

        const password = 'psw';
        const state = {
            currentPassword: 'currentPassword',
            newPassword: password,
            confirmPassword: password,
        };
        wrapper.setState(state);

        await wrapper.instance().submitPassword();

        expect(updateUserPassword).toHaveBeenCalled();
        expect(updateUserPassword).toHaveBeenCalledWith(
            user.id,
            state.currentPassword,
            state.newPassword,
        );

        expect(requiredProps.updateSection).toHaveBeenCalled();
        expect(requiredProps.updateSection).toHaveBeenCalledWith('');
    });

    test('deauthorizeApp() should have called deauthorizeOAuthApp', () => {
        const appId = 'appId';
        const event: any = {
            currentTarget: {getAttribute: jest.fn().mockReturnValue(appId)},
            preventDefault: jest.fn(),
        };

        const wrapper = shallow<SecurityTab>(<SecurityTab {...requiredProps}/>);
        wrapper.setState({authorizedApps: []});
        wrapper.instance().deauthorizeApp(event);

        expect(requiredProps.actions.deauthorizeOAuthApp).toHaveBeenCalled();
        expect(requiredProps.actions.deauthorizeOAuthApp).toHaveBeenCalledWith(
            appId,
        );
    });

    test('deauthorizeApp() should have updated state.authorizedApps', async () => {
        const promise = Promise.resolve({data: true});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, deauthorizeOAuthApp: () => promise},
        };

        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);

        const appId = 'appId';
        const apps = [{id: appId}, {id: '2'}] as OAuthApp[];
        const event: any = {
            currentTarget: {getAttribute: jest.fn().mockReturnValue(appId)},
            preventDefault: jest.fn(),
        };
        wrapper.setState({authorizedApps: apps});
        wrapper.instance().deauthorizeApp(event);

        await promise;

        expect(wrapper.state().authorizedApps).toEqual(apps.slice(1));
    });

    test('deauthorizeApp() should have updated state.serverError', async () => {
        const error = {message: 'error'};
        const promise = Promise.resolve({error});
        const props = {
            ...requiredProps,
            actions: {...requiredProps.actions, deauthorizeOAuthApp: () => promise},
        };

        const wrapper = shallow<SecurityTab>(<SecurityTab {...props}/>);

        const event: any = {
            currentTarget: {getAttribute: jest.fn().mockReturnValue('appId')},
            preventDefault: jest.fn(),
        };
        wrapper.instance().deauthorizeApp(event);

        await promise;

        expect(wrapper.state('serverError')).toEqual(error.message);
    });
});
