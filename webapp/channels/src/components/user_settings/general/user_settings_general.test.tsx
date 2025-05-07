// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Provider} from 'react-redux';

import type {UserPropertyField} from '@mattermost/types/properties';
import type {UserProfile} from '@mattermost/types/users';

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
        customProfileAttributeFields: [],
        actions: {
            logError: jest.fn(),
            clearErrors: jest.fn(),
            updateMe: jest.fn(),
            sendVerificationEmail: jest.fn(),
            setDefaultProfileImage: jest.fn(),
            uploadProfileImage: jest.fn(),
            saveCustomProfileAttribute: jest.fn(),
            getCustomProfileAttributeValues: jest.fn(),
        },
        maxFileSize: 1024,
        ldapPositionAttributeSet: false,
        samlPositionAttributeSet: false,
        ldapPictureAttributeSet: false,
        enableCustomProfileAttributes: false,
    };

    const customProfileAttribute: UserPropertyField = {
        id: 'field1',
        group_id: 'custom_profile_attributes',
        name: 'Test Attribute',
        type: 'text',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
        },
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
        const testUser = {...user, custom_profile_attributes: {}};

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [customProfileAttribute],
            user: testUser,
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(props.actions.getCustomProfileAttributeValues).not.toHaveBeenCalled();
        expect(await screen.getByRole('button', {name: `${customProfileAttribute.name} Edit`})).toBeInTheDocument();
        expect(await screen.findByText('Click \'Edit\' to add your custom attribute'));
    });

    test('should show Custom Attribute Field with empty value', async () => {
        const testUser = {...user, custom_profile_attributes: {field1: ''}};

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [customProfileAttribute],
            user: testUser,
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(props.actions.getCustomProfileAttributeValues).not.toHaveBeenCalled();
        expect(await screen.getByRole('button', {name: `${customProfileAttribute.name} Edit`})).toBeInTheDocument();
        expect(await screen.findByText('Click \'Edit\' to add your custom attribute'));
    });

    test('should show Custom Attribute Field with value', async () => {
        const testUser = {...user, custom_profile_attributes: {field1: 'FieldOneValue'}};

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [customProfileAttribute],
            user: testUser,
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(props.actions.getCustomProfileAttributeValues).not.toHaveBeenCalled();
        expect(await screen.findByText('FieldOneValue')).toBeInTheDocument();
    });

    test('should call getCustomProfileAttributeValues if users properties are null', async () => {
        const testUser = {...user};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [customProfileAttribute],
            actions: {...requiredProps.actions},
            user: testUser,
        };

        const {rerender} = renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(props.actions.getCustomProfileAttributeValues).toHaveBeenCalledTimes(1);
        expect(await screen.getByRole('button', {name: `${customProfileAttribute.name} Edit`})).toBeInTheDocument();

        props.user = {...testUser, custom_profile_attributes: {field1: 'FieldOneValue'}};
        rerender(<UserSettingsGeneral {...props}/>);
        expect(props.actions.getCustomProfileAttributeValues).toHaveBeenCalledTimes(1);
        expect(await screen.findByText('FieldOneValue')).toBeInTheDocument();
    });

    test('should show Custom Attribute Field editing with empty value', async () => {
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [customProfileAttribute],
            user,
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(await screen.getByRole('textbox', {name: `${customProfileAttribute.name}`})).toBeInTheDocument();
    });

    test('should show select Custom Attribute Field with value', async () => {
        const selectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'select',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},
                    {id: 'opt2', name: 'Option 2', color: ''},
                ],
            },
        };

        const testUser = {...user, custom_profile_attributes: {field1: 'opt1'}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [selectAttribute],
            user: testUser,
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(await screen.getByText('Option 1')).toBeInTheDocument();
    });

    test('should show multiselect Custom Attribute Field with value', async () => {
        const multiselectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'multiselect',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},
                    {id: 'opt2', name: 'Option 2', color: ''},
                ],
            },
        };

        const testUser = {...user, custom_profile_attributes: {field1: 'opt2'}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [multiselectAttribute],
            user: testUser,
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(await screen.getByText('Option 2')).toBeInTheDocument();
    });

    test('submitAttribute() should have called saveCustomProfileAttribute', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({field1: 'Updated Value'});
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            actions: {...requiredProps.actions, saveCustomProfileAttribute},
            customProfileAttributeFields: [customProfileAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.getByRole('textbox', {name: `${customProfileAttribute.name}`})).toBeInTheDocument();
        expect(await screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
        userEvent.clear(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}));
        userEvent.type(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}), 'Updated Value');
        userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(saveCustomProfileAttribute).toHaveBeenCalledTimes(1);
        expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'Updated Value');
    });

    test('submitAttribute() should handle server error', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({error: {message: 'Server Error'}});
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            actions: {...requiredProps.actions, saveCustomProfileAttribute},
            customProfileAttributeFields: [customProfileAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        userEvent.clear(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}));
        userEvent.type(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}), 'Updated Value');
        userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('Server Error')).toBeInTheDocument();
    });

    test('updateSelectAttribute() should handle single select changes', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const selectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'select',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},
                    {id: 'opt2', name: 'Option 2', color: ''},
                ],
            },
        };

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [selectAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        const select = await screen.findByText('Select');
        userEvent.click(select);
        userEvent.click(await screen.findByText('Option 2'));

        const saveButton = screen.getByRole('button', {name: 'Save'});
        userEvent.click(saveButton);

        expect(props.actions.saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'opt2');
    });

    test('updateSelectAttribute() should handle multi-select changes', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const multiselectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'multiselect',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},
                    {id: 'opt2', name: 'Option 2', color: ''},
                ],
            },
        };

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [multiselectAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        const select = await screen.findByText('Select');
        userEvent.click(select);
        userEvent.click(await screen.findByText('Option 1'));

        userEvent.click(await screen.findByText('Option 1'));
        userEvent.click(await screen.findByText('Option 2'));

        const saveButton = screen.getByRole('button', {name: 'Save'});
        userEvent.click(saveButton);

        expect(props.actions.saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt1', 'opt2']);
    });

    test('updateSelectAttribute() should handle clearing selections', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const selectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'select',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},
                    {id: 'opt2', name: 'Option 2', color: ''},
                ],
            },
        };

        const testUser = {...user, custom_profile_attributes: {field1: 'opt1'}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [selectAttribute],
            user: testUser,
            activeSection: 'customAttribute_field1',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        const {container} = renderWithContext(<UserSettingsGeneral {...props}/>);

        const clearIndicator = container.querySelector('.react-select__clear-indicator');
        expect(clearIndicator).toBeInTheDocument();

        userEvent.click(clearIndicator!);
        await screen.findByText('Select');

        const saveButton = screen.getByRole('button', {name: 'Save'});
        userEvent.click(saveButton);

        expect(props.actions.saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', '');
    });

    test('should handle select with removed options', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const selectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'select',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},

                    // opt2 has been removed from options
                ],
            },
        };

        // User has a value for an option that no longer exists
        const testUser = {...user, custom_profile_attributes: {field1: 'opt2'}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [selectAttribute],
            user: testUser,
            activeSection: '',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        // Should not display any value since the option no longer exists
        expect(screen.queryByText('Option 2')).not.toBeInTheDocument();
        expect(await screen.findByText('Click \'Edit\' to add your custom attribute')).toBeInTheDocument();
    });

    test('should handle multiselect with removed options', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const multiselectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'multiselect',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},

                    // opt2 and opt3 have been removed from options
                ],
            },
        };

        // User has values for options that no longer exist
        const testUser = {...user, custom_profile_attributes: {field1: ['opt1', 'opt2', 'opt3']}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [multiselectAttribute],
            user: testUser,
            activeSection: '',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        // Should only display the option that still exists
        expect(await screen.findByText('Option 1')).toBeInTheDocument();
        expect(screen.queryByText('Option 2')).not.toBeInTheDocument();
        expect(screen.queryByText('Option 3')).not.toBeInTheDocument();
    });

    test('should handle editing select with removed options', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const selectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'select',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},

                    // opt2 has been removed from options
                ],
            },
        };

        // User has a value for an option that no longer exists
        const testUser = {...user, custom_profile_attributes: {field1: 'opt2'}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [selectAttribute],
            user: testUser,
            activeSection: 'customAttribute_field1',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        // Should show empty select since the option no longer exists
        expect(await screen.findByText('Select')).toBeInTheDocument();

        // Select a valid option and save
        userEvent.click(screen.getByText('Select'));
        userEvent.click(await screen.findByText('Option 1'));
        userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'opt1');
    });

    test('should handle editing multiselect with removed options', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const multiselectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'multiselect',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},
                    {id: 'opt3', name: 'Option 3', color: ''},

                    // opt2 has been removed from options
                ],
            },
        };

        // User has values including one for an option that no longer exists
        const testUser = {...user, custom_profile_attributes: {field1: ['opt1', 'opt2']}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [multiselectAttribute],
            user: testUser,
            activeSection: 'customAttribute_field1',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        // Should only show the valid option
        expect(await screen.findByText('Option 1')).toBeInTheDocument();
        expect(screen.queryByText('Option 2')).not.toBeInTheDocument();

        // Add another valid option and save
        userEvent.click(await screen.findByText('Option 1'));
        userEvent.click(await screen.findByText('Option 3'));
        userEvent.click(screen.getByRole('button', {name: 'Save'}));

        // Should save with only the valid options
        expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt1', 'opt3']);
    });

    test('should not show custom attribute input field when LDAP attribute is set', async () => {
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [
                {
                    ...customProfileAttribute,
                    attrs: {
                        ...customProfileAttribute.attrs,
                        ldap: 'ldap_field',
                    },
                },
            ],
            user: {...user, auth_service: 'ldap'},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: customProfileAttribute.name})).not.toBeInTheDocument();
        expect(await screen.findByText('This field is handled through your login provider. If you want to change it, you need to do so through your login provider.')).toBeInTheDocument();
    });

    test('should not show custom attribute input field when SAML attribute is set', async () => {
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [
                {
                    ...customProfileAttribute,
                    attrs: {
                        ...customProfileAttribute.attrs,
                        saml: 'saml_field',
                    },
                },
            ],
            user: {...user, auth_service: 'saml'},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(await screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: customProfileAttribute.name})).not.toBeInTheDocument();
        expect(await screen.findByText('This field is handled through your login provider. If you want to change it, you need to do so through your login provider.')).toBeInTheDocument();
    });

    test('should show custom attribute input field when LDAP auth but no LDAP attribute set', async () => {
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [
                {
                    ...customProfileAttribute,
                    attrs: {
                        ...customProfileAttribute.attrs,
                        ldap: '',
                    },
                },
            ],
            user: {...user, auth_service: 'ldap'},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(await screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: customProfileAttribute.name})).toBeInTheDocument();
    });

    test('should validate URL custom attribute field value', async () => {
        const urlAttribute: UserPropertyField = {
            ...customProfileAttribute,
            attrs: {
                ...customProfileAttribute.attrs,
                value_type: 'url',
            },
        };

        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [urlAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        userEvent.type(screen.getByRole('textbox', {name: urlAttribute.name}), 'ftp://invalid-scheme');
        userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('Please enter a valid url.')).toBeInTheDocument();
        expect(saveCustomProfileAttribute).not.toHaveBeenCalled();

        userEvent.clear(screen.getByRole('textbox', {name: urlAttribute.name}));
        userEvent.type(screen.getByRole('textbox', {name: urlAttribute.name}), 'example.com');
        userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'http://example.com');
    });

    test('should validate email custom attribute field value', async () => {
        const emailAttribute: UserPropertyField = {
            ...customProfileAttribute,
            attrs: {
                ...customProfileAttribute.attrs,
                value_type: 'email',
            },
        };

        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [emailAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        userEvent.type(screen.getByRole('textbox', {name: emailAttribute.name}), 'invalid-email');
        userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument();
        expect(saveCustomProfileAttribute).not.toHaveBeenCalled();

        userEvent.clear(screen.getByRole('textbox', {name: emailAttribute.name}));
        userEvent.type(screen.getByRole('textbox', {name: emailAttribute.name}), 'test@example.com');
        userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'test@example.com');
    });
});
