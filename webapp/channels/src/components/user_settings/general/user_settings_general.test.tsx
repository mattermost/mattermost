// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import type {UserProfile} from '@mattermost/types/users';

import configureStore from 'store';

import {shallowWithIntl, mountWithIntl} from 'tests/helpers/intl-test-helper';
import {TestHelper} from 'utils/test_helper';

import UserSettingsGeneral from './user_settings_general';
import type {UserSettingsGeneralTab} from './user_settings_general';

describe('components/user_settings/general/UserSettingsGeneral', () => {
    const user: UserProfile = TestHelper.getUserMock({
        id: 'user_id',
        username: 'user_name',
        first_name: 'first_name',
        last_name: 'last_name',
        nickname: 'nickname',
        position: '',
        email: '',
        password: '',
        auth_service: '',
        last_picture_update: 0,
    });

    const requiredProps = {
        user,
        updateSection: jest.fn(),
        updateTab: jest.fn(),
        activeSection: '',
        closeModal: jest.fn(),
        collapseModal: jest.fn(),
        actions: {
            logError: jest.fn(),
            clearErrors: jest.fn(),
            updateMe: jest.fn(),
            sendVerificationEmail: jest.fn(),
            setDefaultProfileImage: jest.fn(),
            uploadProfileImage: jest.fn(),
        },
        maxFileSize: 1024,
        ldapPositionAttributeSet: false,
        samlPositionAttributeSet: false,
        ldapPictureAttributeSet: false,
    };

    let store: ReturnType<typeof configureStore>;
    beforeEach(() => {
        store = configureStore();
    });

    test('submitUser() should have called updateMe', () => {
        const updateMe = jest.fn().mockResolvedValue({data: true});
        const props = {...requiredProps, actions: {...requiredProps.actions, updateMe}};
        const wrapper = shallowWithIntl(<UserSettingsGeneral {...props}/>);

        (wrapper.instance() as UserSettingsGeneralTab).submitUser(requiredProps.user, false);
        expect(updateMe).toHaveBeenCalledTimes(1);
        expect(updateMe).toHaveBeenCalledWith(requiredProps.user);
    });

    test('submitPicture() should not have called uploadProfileImage', () => {
        const uploadProfileImage = jest.fn().mockResolvedValue({});
        const props = {...requiredProps, actions: {...requiredProps.actions, uploadProfileImage}};
        const wrapper = shallowWithIntl(<UserSettingsGeneral {...props}/>);

        (wrapper.instance() as UserSettingsGeneralTab).submitPicture();
        expect(uploadProfileImage).toHaveBeenCalledTimes(0);
    });

    test('submitPicture() should have called uploadProfileImage', async () => {
        const uploadProfileImage = jest.fn(() => Promise.resolve({data: true}));
        const props = {...requiredProps, actions: {...requiredProps.actions, uploadProfileImage}};
        const wrapper = shallowWithIntl(<UserSettingsGeneral {...props}/>);

        const mockFile = {type: 'image/jpeg', size: requiredProps.maxFileSize};
        const event: any = {target: {files: [mockFile]}};

        (wrapper.instance() as UserSettingsGeneralTab).updatePicture(event);

        expect(wrapper.state('pictureFile')).toBe(event.target.files[0]);
        expect((wrapper.instance() as UserSettingsGeneralTab).submitActive).toBe(true);

        await (wrapper.instance() as UserSettingsGeneralTab).submitPicture();

        expect(uploadProfileImage).toHaveBeenCalledTimes(1);
        expect(uploadProfileImage).toHaveBeenCalledWith(requiredProps.user.id, mockFile);

        expect(wrapper.state('pictureFile')).toBe(null);
        expect((wrapper.instance() as UserSettingsGeneralTab).submitActive).toBe(false);

        expect(requiredProps.updateSection).toHaveBeenCalledTimes(1);
        expect(requiredProps.updateSection).toHaveBeenCalledWith('');
    });

    test('should not show position input field when LDAP or SAML position attribute is set', () => {
        const props = {...requiredProps};
        props.user = {...user};
        props.user.auth_service = 'ldap';
        props.activeSection = 'position';

        props.ldapPositionAttributeSet = false;
        props.samlPositionAttributeSet = false;

        let wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsGeneral {...props}/>
            </Provider>,
        );
        expect(wrapper.find('#position').length).toBe(1);
        expect(wrapper.find('#position').is('input')).toBeTruthy();

        props.ldapPositionAttributeSet = true;
        props.samlPositionAttributeSet = false;

        wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsGeneral {...props}/>
            </Provider>,
        );
        expect(wrapper.find('#position').length).toBe(0);

        props.user.auth_service = 'saml';
        props.ldapPositionAttributeSet = false;
        props.samlPositionAttributeSet = true;

        wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsGeneral {...props}/>
            </Provider>,
        );
        expect(wrapper.find('#position').length).toBe(0);
    });

    test('should not show image field when LDAP picture attribute is set', () => {
        const props = {...requiredProps};
        props.user = {...user};
        props.user.auth_service = 'ldap';
        props.activeSection = 'picture';

        props.ldapPictureAttributeSet = false;

        let wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsGeneral {...props}/>
            </Provider>,
        );
        expect(wrapper.find('.profile-img').exists()).toBeTruthy();

        props.ldapPictureAttributeSet = true;
        wrapper = mountWithIntl(
            <Provider store={store}>
                <UserSettingsGeneral {...props}/>
            </Provider>,
        );
        expect(wrapper.find('.profile-img').exists()).toBeFalsy();
    });

    test('it should display an error about a username conflicting with a group name', async () => {
        const updateMe = () => Promise.resolve({data: false, error: {server_error_id: 'app.user.group_name_conflict', message: ''}});
        const props = {...requiredProps, actions: {...requiredProps.actions, updateMe}};
        const wrapper = shallowWithIntl(<UserSettingsGeneral {...props}/>);
        await (wrapper.instance() as UserSettingsGeneralTab).submitUser(requiredProps.user, false);
        expect(wrapper.state('serverError')).toBe('This username conflicts with an existing group name.');
    });
});
