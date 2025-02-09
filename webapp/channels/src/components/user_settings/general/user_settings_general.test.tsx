// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import type {UserPropertyField} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

import {Client4} from 'mattermost-redux/client';

import configureStore from 'store';

import {shallowWithIntl, mountWithIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserSettingsGeneral from './user_settings_general';
import type {UserSettingsGeneralTab} from './user_settings_general';

jest.mock('@mattermost/client', () => ({
    ...jest.requireActual('@mattermost/client'),
    Client4: class MockClient4 extends jest.requireActual('@mattermost/client').Client4 {
        getUserCustomProfileAttributesValues = jest.fn();
    },
}));

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
        isMobileView: false,
        customProfileAttributeFields: {},
        actions: {
            logError: jest.fn(),
            clearErrors: jest.fn(),
            updateMe: jest.fn(),
            sendVerificationEmail: jest.fn(),
            setDefaultProfileImage: jest.fn(),
            uploadProfileImage: jest.fn(),
            saveCustomProfileAttribute: jest.fn(),
            getCustomProfileAttributeFields: jest.fn(),
        },
        maxFileSize: 1024,
        ldapPositionAttributeSet: false,
        samlPositionAttributeSet: false,
        ldapPictureAttributeSet: false,
        enableCustomProfileAttributes: false,
    };

    const customProfileAttribute: UserPropertyField = {
        id: '1',
        group_id: 'custom_profile_attributes',
        name: 'Test Attribute',
        type: 'text',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
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

    test('should show Custom Attribute Field with no value', async () => {
        (Client4.getUserCustomProfileAttributesValues as jest.Mock).mockImplementation(async () => {
            return {};
        });
        const props = {...requiredProps, enableCustomProfileAttributes: true, customProfileAttributeFields: {1: customProfileAttribute}};
        props.user = {...user};

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.getByRole('button', {name: `${customProfileAttribute.name} Edit`})).toBeInTheDocument();
        expect(await screen.findByText('Click \'Edit\' to add your custom attribute'));
    });

    test('should show Custom Attribute Field with empty value', async () => {
        (Client4.getUserCustomProfileAttributesValues as jest.Mock).mockImplementation(async () => {
            return {
                1: '',
            };
        });
        const props = {...requiredProps, enableCustomProfileAttributes: true, customProfileAttributeFields: {1: customProfileAttribute}};
        props.user = {...user};

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.getByRole('button', {name: `${customProfileAttribute.name} Edit`})).toBeInTheDocument();
        expect(await screen.findByText('Click \'Edit\' to add your custom attribute'));
    });

    test('should show Custom Attribute Field with value set', async () => {
        (Client4.getUserCustomProfileAttributesValues as jest.Mock).mockImplementation(async () => {
            return {1: 'Custom Attribute Value'};
        });
        const props = {...requiredProps, enableCustomProfileAttributes: true, customProfileAttributeFields: {1: customProfileAttribute}};
        props.user = {...user};

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.getByRole('button', {name: `${customProfileAttribute.name} Edit`})).toBeInTheDocument();
        expect(await screen.findByText('Custom Attribute Value'));
    });

    test('should show Custom Attribute Field editing with empty value', async () => {
        const props = {...requiredProps, enableCustomProfileAttributes: true, customProfileAttributeFields: {1: customProfileAttribute}};
        props.user = {...user};
        props.activeSection = 'customAttribute_1';

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.getByRole('textbox', {name: `${customProfileAttribute.name}`})).toBeInTheDocument();
    });

    test('submitAttribute() should have called saveCustomProfileAttribute', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({1: 'Updated Value'});
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            actions: {...requiredProps.actions, saveCustomProfileAttribute},
            customProfileAttributeFields: {1: customProfileAttribute},
            user: {...user},
            activeSection: 'customAttribute_1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.getByRole('textbox', {name: `${customProfileAttribute.name}`})).toBeInTheDocument();
        expect(await screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
        userEvent.clear(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}));
        userEvent.type(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}), 'Updated Value');
        userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(saveCustomProfileAttribute).toHaveBeenCalledTimes(1);
        expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', '1', 'Updated Value');
    });
});
