// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import {clearPropertyFieldOptionWalks, pageAllAccessControlFieldOptions} from 'components/property_fields/graph/page_all_access_control_field_options';
import {clearGraphOptionNameCache} from 'components/property_fields/graph/use_graph_option_names';

import {defaultIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen, userEvent, act, fireEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import UserSettingsGeneral, {UserSettingsGeneralTab} from './user_settings_general';

jest.mock('components/property_fields/graph/page_all_access_control_field_options', () => ({
    ...jest.requireActual('components/property_fields/graph/page_all_access_control_field_options'),

    pageAllAccessControlFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllAccessControlFieldOptions);

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
        intl: defaultIntl,
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
        lockProfileFieldsForEmailUsers: 'none' as const,
        canEditOtherUsers: false,
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
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: '',
        object_type: '',
        attrs: {
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
        },
    };

    test('submitUser() should have called updateMe', async () => {
        const updateMe = jest.fn().mockResolvedValue({data: true});
        const props = {...requiredProps, actions: {...requiredProps.actions, updateMe}};
        const ref = React.createRef<UserSettingsGeneralTab>();
        renderWithContext(
            <UserSettingsGeneralTab
                {...props}
                ref={ref}
            />,
        );

        await act(async () => {
            ref.current!.submitUser(requiredProps.user, false);
        });
        expect(updateMe).toHaveBeenCalledTimes(1);
        expect(updateMe).toHaveBeenCalledWith(requiredProps.user);
    });

    test('submitPicture() should not have called uploadProfileImage', () => {
        const uploadProfileImage = jest.fn().mockResolvedValue({});
        const props = {...requiredProps, actions: {...requiredProps.actions, uploadProfileImage}};
        const ref = React.createRef<UserSettingsGeneralTab>();
        renderWithContext(
            <UserSettingsGeneralTab
                {...props}
                ref={ref}
            />,
        );

        ref.current!.submitPicture();
        expect(uploadProfileImage).toHaveBeenCalledTimes(0);
    });

    test('submitPicture() should have called uploadProfileImage', async () => {
        const uploadProfileImage = jest.fn(() => Promise.resolve({data: true}));
        const props = {...requiredProps, actions: {...requiredProps.actions, uploadProfileImage}};
        const ref = React.createRef<UserSettingsGeneralTab>();
        renderWithContext(
            <UserSettingsGeneralTab
                {...props}
                ref={ref}
            />,
        );

        const mockFile = {type: 'image/jpeg', size: requiredProps.maxFileSize};
        const event: any = {target: {files: [mockFile]}};

        act(() => {
            ref.current!.updatePicture(event);
        });

        expect(ref.current!.state.pictureFile).toBe(event.target.files[0]);
        expect(ref.current!.submitActive).toBe(true);

        await act(async () => {
            await ref.current!.submitPicture();
        });

        expect(uploadProfileImage).toHaveBeenCalledTimes(1);
        expect(uploadProfileImage).toHaveBeenCalledWith(requiredProps.user.id, mockFile);

        expect(ref.current!.state.pictureFile).toBe(null);
        expect(ref.current!.submitActive).toBe(false);

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

        const {container, rerender} = renderWithContext(
            <UserSettingsGeneral {...props}/>,
        );
        expect(container.querySelectorAll('#position').length).toBe(1);
        expect(container.querySelector('#position.Input')?.tagName).toBe('INPUT');

        props.ldapPositionAttributeSet = true;
        props.samlPositionAttributeSet = false;

        rerender(
            <UserSettingsGeneral {...{...props, ldapPositionAttributeSet: true, samlPositionAttributeSet: false}}/>,
        );
        expect(container.querySelectorAll('#position').length).toBe(0);

        rerender(
            <UserSettingsGeneral
                {...{
                    ...props,
                    user: {...user, auth_service: 'saml'},
                    ldapPositionAttributeSet: false,
                    samlPositionAttributeSet: true,
                }}
            />,
        );
        expect(container.querySelectorAll('#position').length).toBe(0);
    });

    test('should show the current image without edit actions when LDAP picture attribute is set', () => {
        const props = {...requiredProps};
        props.user = {...user};
        props.user.auth_service = 'ldap';
        props.activeSection = 'picture';

        props.ldapPictureAttributeSet = false;

        const {container, rerender} = renderWithContext(
            <UserSettingsGeneral {...props}/>,
        );
        expect(container.querySelector('.profile-img')).toBeTruthy();

        rerender(
            <UserSettingsGeneral {...{...props, ldapPictureAttributeSet: true}}/>,
        );
        expect(container.querySelector('.profile-img')).toBeTruthy();
        expect(screen.queryByTestId('inputSettingPictureButton')).not.toBeInTheDocument();
        expect(screen.queryByTestId('saveSettingPicture')).not.toBeInTheDocument();
        expect(screen.queryByTestId('removeSettingPicture')).not.toBeInTheDocument();
    });

    describe('locked profile fields for email users', () => {
        const lockedProps = {
            ...requiredProps,
            user: {...user},
            lockProfileFieldsForEmailUsers: 'all' as const,
        };

        test('should hide fully locked field editors', () => {
            const {rerender} = renderWithContext(
                <UserSettingsGeneral
                    {...lockedProps}
                    activeSection='name'
                />,
            );

            expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Last Name')).not.toBeInTheDocument();
            expect(screen.getByText('This field is managed by your System Admin. Contact them to request a change.')).toBeInTheDocument();

            rerender(
                <UserSettingsGeneral
                    {...lockedProps}
                    activeSection='username'
                />,
            );
            expect(screen.queryByLabelText('Username')).not.toBeInTheDocument();

            rerender(
                <UserSettingsGeneral
                    {...lockedProps}
                    activeSection='nickname'
                />,
            );
            expect(screen.queryByLabelText('Nickname')).not.toBeInTheDocument();

            rerender(
                <UserSettingsGeneral
                    {...lockedProps}
                    activeSection='position'
                />,
            );
            expect(screen.queryByLabelText('Position')).not.toBeInTheDocument();
        });

        test('should allow an empty last name to be filled once', () => {
            renderWithContext(
                <UserSettingsGeneral
                    {...lockedProps}
                    user={{...user, first_name: 'First', last_name: ''}}
                    activeSection='name'
                />,
            );

            expect(screen.getByLabelText('First Name')).toBeDisabled();
            expect(screen.getByLabelText('Last Name')).toBeEnabled();
        });

        test('should keep the current picture visible without edit actions when all fields are locked', () => {
            const {container} = renderWithContext(
                <UserSettingsGeneral
                    {...lockedProps}
                    activeSection='picture'
                />,
            );

            expect(container.querySelector('.profile-img')).toBeTruthy();
            expect(screen.queryByTestId('inputSettingPictureButton')).not.toBeInTheDocument();
            expect(screen.queryByTestId('saveSettingPicture')).not.toBeInTheDocument();
            expect(screen.queryByTestId('removeSettingPicture')).not.toBeInTheDocument();
        });

        test('should show the login provider message instead of the admin lock', () => {
            renderWithContext(
                <UserSettingsGeneral
                    {...lockedProps}
                    user={{...user, auth_service: 'ldap'}}
                    ldapFirstNameAttributeSet={true}
                    activeSection='name'
                />,
            );

            expect(screen.getByText('This field is handled through your login provider. If you want to change it, you need to do so through your login provider.')).toBeInTheDocument();
            expect(screen.queryByText('This field is managed by your System Admin. Contact them to request a change.')).not.toBeInTheDocument();
        });
    });

    test('it should display an error about a username conflicting with a group name', async () => {
        const updateMe = () => Promise.resolve({data: false, error: {server_error_id: 'app.user.group_name_conflict', message: ''}});
        const props = {...requiredProps, actions: {...requiredProps.actions, updateMe}};
        const ref = React.createRef<UserSettingsGeneralTab>();
        renderWithContext(
            <UserSettingsGeneralTab
                {...props}
                ref={ref}
            />,
        );
        await act(async () => {
            await ref.current!.submitUser(requiredProps.user, false);
        });
        expect(ref.current!.state.serverError).toBe('This username conflicts with an existing group name.');
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
        await userEvent.clear(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}));
        await userEvent.type(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}), 'Updated Value');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

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

        await userEvent.clear(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}));
        await userEvent.type(screen.getByRole('textbox', {name: `${customProfileAttribute.name}`}), 'Updated Value');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

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
        await userEvent.click(select);
        await userEvent.click(await screen.findByText('Option 2'));

        const saveButton = screen.getByRole('button', {name: 'Save'});
        await userEvent.click(saveButton);

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
        await userEvent.click(select);
        await userEvent.click(await screen.findByText('Option 1'));

        await userEvent.click(await screen.findByText('Option 1'));
        await userEvent.click(await screen.findByText('Option 2'));

        const saveButton = screen.getByRole('button', {name: 'Save'});
        await userEvent.click(saveButton);

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

        await userEvent.click(clearIndicator!);
        await screen.findByText('Select');

        const saveButton = screen.getByRole('button', {name: 'Save'});
        await userEvent.click(saveButton);

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

        // Live name plus raw ids for the deleted options. Dropping the ids
        // here is the collapsed-row under-count Jules filed on qa_stale_multi.
        // FormattedList joins them into one describe node.
        expect(await screen.findByText('Option 1, opt2, and opt3')).toBeInTheDocument();
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
        await userEvent.click(screen.getByText('Select'));
        await userEvent.click(await screen.findByText('Option 1'));
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

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

        expect(await screen.findByText('Option 1')).toBeInTheDocument();
        expect(screen.getByText('opt2')).toBeInTheDocument();

        // Add another live option and save. The ghost id must still be
        // emitted -- "just add another option" used to persist a shrink.
        await userEvent.click(await screen.findByText('Option 1'));
        await userEvent.click(await screen.findByText('Option 3'));
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt1', 'opt2', 'opt3']);
    });

    test('should still show a select value when options are omitted', async () => {
        const selectAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'select',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options_omitted: true,
            },
        };

        const testUser = {...user, custom_profile_attributes: {field1: 'opt1'}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [selectAttribute],
            user: testUser,
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.findByText('opt1')).toBeInTheDocument();
    });

    test('should not let a graph field with omitted options be edited', async () => {
        const graphAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'graph',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                options_omitted: true,
            },
        };

        const testUser = {...user, custom_profile_attributes: {field1: ['opt1', 'opt2']}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [graphAttribute],
            user: testUser,
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.queryByText('Select')).not.toBeInTheDocument();
        expect(await screen.findByText('This field has too many options to be edited here.')).toBeInTheDocument();
    });

    test('should show admin-managed graph Custom Attribute Field option names read-only', async () => {
        const graphAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'graph',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                managed: 'admin',
                options: [
                    {id: 'opt1', name: 'Option 1', color: ''},
                    {id: 'opt2', name: 'Option 2', color: ''},
                ],
            },
        };

        const testUser = {...user, custom_profile_attributes: {field1: ['opt1']}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [graphAttribute],
            user: testUser,
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.findByText('Option 1')).toBeInTheDocument();
        expect(screen.queryByText('opt1')).not.toBeInTheDocument();
    });

    test('updateSelectAttribute() should handle multi-select changes for a graph attribute', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const graphAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'graph',
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
            customProfileAttributeFields: [graphAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
            actions: {
                ...requiredProps.actions,
                saveCustomProfileAttribute,
            },
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        const select = await screen.findByText('Select');
        await userEvent.click(select);
        await userEvent.click(await screen.findByText('Option 1'));

        await userEvent.click(await screen.findByText('Option 1'));
        await userEvent.click(await screen.findByText('Option 2'));

        const saveButton = screen.getByRole('button', {name: 'Save'});
        await userEvent.click(saveButton);

        expect(props.actions.saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt1', 'opt2']);
    });

    test('updateSelectAttribute() should clear a graph attribute as an empty array', async () => {
        const saveCustomProfileAttribute = jest.fn().mockResolvedValue({});
        const graphAttribute: UserPropertyField = {
            ...customProfileAttribute,
            type: 'graph',
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

        const testUser = {...user, custom_profile_attributes: {field1: ['opt1']}};
        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [graphAttribute],
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

        await userEvent.click(clearIndicator!);
        await screen.findByText('Select');

        const saveButton = screen.getByRole('button', {name: 'Save'});
        await userEvent.click(saveButton);

        expect(props.actions.saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', []);
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
        const input = screen.getByRole('textbox', {name: urlAttribute.name});

        // Type the invalid value
        await userEvent.type(input, 'ftp://invalid-scheme');

        // Trigger validation - fireEvent used because userEvent doesn't have direct focus/blur methods
        await act(async () => {
            fireEvent.focus(input);
            fireEvent.blur(input, {relatedTarget: null});
        });

        // Wait for validation error to appear
        await waitFor(() => {
            expect(screen.getByText('Please enter a valid url.')).toBeInTheDocument();
        });
        expect(saveCustomProfileAttribute).not.toHaveBeenCalled();
        await userEvent.clear(input);
        await userEvent.type(input, 'example.com');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));
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
        const input = screen.getByRole('textbox', {name: emailAttribute.name});

        // Type the invalid value
        await userEvent.type(input, 'invalid-email');

        await act(async () => {
            fireEvent.focus(input);
            fireEvent.blur(input, {relatedTarget: null});
        });

        // Wait for validation error to appear
        await waitFor(() => {
            expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument();
        });
        expect(saveCustomProfileAttribute).not.toHaveBeenCalled();
        await userEvent.clear(input);
        await userEvent.type(input, 'test@example.com');
        await userEvent.click(screen.getByRole('button', {name: 'Save'}));

        expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', 'test@example.com');
    });

    test('should not show custom attribute input field when field is admin-managed', async () => {
        const adminManagedAttribute: UserPropertyField = {
            ...customProfileAttribute,
            attrs: {
                ...customProfileAttribute.attrs,
                managed: 'admin',
            },
        };

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [adminManagedAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: adminManagedAttribute.name})).not.toBeInTheDocument();
        expect(await screen.findByText('This field can only be changed by an administrator.')).toBeInTheDocument();
    });

    test('should show custom attribute input field when field is not admin-managed', async () => {
        const regularAttribute: UserPropertyField = {
            ...customProfileAttribute,
            attrs: {
                ...customProfileAttribute.attrs,
                managed: '',
            },
        };

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [regularAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(await screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: regularAttribute.name})).toBeInTheDocument();
        expect(screen.queryByText('This field can only be changed by an administrator.')).not.toBeInTheDocument();
    });

    test('should not show custom attribute input field when field is protected', async () => {
        const protectedAttribute: UserPropertyField = {
            ...customProfileAttribute,
            attrs: {
                ...customProfileAttribute.attrs,
                protected: true,
            },
        };

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [protectedAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: protectedAttribute.name})).not.toBeInTheDocument();
        expect(await screen.findByText(/This field is managed by a plugin and cannot be edited\./)).toBeInTheDocument();
    });

    test('should show custom attribute input field when field is not protected', async () => {
        const normalAttribute: UserPropertyField = {
            ...customProfileAttribute,
            attrs: {
                ...customProfileAttribute.attrs,
                protected: false,
            },
        };

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [normalAttribute],
            user: {...user},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);
        expect(await screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: normalAttribute.name})).toBeInTheDocument();
        expect(screen.queryByText('This field is managed by a plugin and cannot be edited.')).not.toBeInTheDocument();
    });

    test('should render section title using display_name when collapsed', async () => {
        const attributeWithDisplayName: UserPropertyField = {
            ...customProfileAttribute,
            attrs: {
                ...customProfileAttribute.attrs,
                display_name: 'Friendly Display Name',
            },
        };

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [attributeWithDisplayName],
            user: {...user, custom_profile_attributes: {field1: 'FieldOneValue'}},
            activeSection: '',
        };

        const {container} = renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.findByRole('button', {name: 'Friendly Display Name Edit'})).toBeInTheDocument();
        const titleHeading = container.querySelector('#customAttribute_field1Title');
        expect(titleHeading).not.toBeNull();
        expect(titleHeading).toHaveTextContent('Friendly Display Name');
        expect(screen.queryByRole('button', {name: `${attributeWithDisplayName.name} Edit`})).not.toBeInTheDocument();
    });

    test('should render SettingItemMax title using display_name when expanded', async () => {
        const attributeWithDisplayName: UserPropertyField = {
            ...customProfileAttribute,
            attrs: {
                ...customProfileAttribute.attrs,
                display_name: 'Friendly Display Name',
            },
        };

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [attributeWithDisplayName],
            user: {...user},
            activeSection: 'customAttribute_field1',
        };

        const {container} = renderWithContext(<UserSettingsGeneral {...props}/>);

        const maxTitle = await screen.findByRole('heading', {name: 'Friendly Display Name'});
        expect(maxTitle).toHaveAttribute('id', 'settingTitle');

        const controlLabels = container.querySelectorAll('label.control-label');
        expect(controlLabels.length).toBeGreaterThan(0);
        expect(Array.from(controlLabels).some((el) => el.textContent === 'Friendly Display Name')).toBe(true);
    });

    test('should set input aria-label using display_name when expanded', async () => {
        const attributeWithDisplayName: UserPropertyField = {
            ...customProfileAttribute,
            attrs: {
                ...customProfileAttribute.attrs,
                display_name: 'Friendly Display Name',
            },
        };

        const props = {
            ...requiredProps,
            enableCustomProfileAttributes: true,
            customProfileAttributeFields: [attributeWithDisplayName],
            user: {...user},
            activeSection: 'customAttribute_field1',
        };

        renderWithContext(<UserSettingsGeneral {...props}/>);

        expect(await screen.findByRole('textbox', {name: 'Friendly Display Name'})).toBeInTheDocument();
        expect(screen.queryByRole('textbox', {name: attributeWithDisplayName.name})).not.toBeInTheDocument();
    });

    describe('graph omit-unlock', () => {
        const OMITTED_COPY = 'This field has too many options to be edited here.';
        const SECTION = 'customAttribute_field1';

        const graphOption = (id: string, name: string, parents: string[] = []) => ({
            id, name, parents, create_at: 1,
        });

        // Regime 1: a small field that inlines every option.
        const REGIME_1 = [
            graphOption('opt1', 'Option 1'),
            graphOption('opt2', 'Option 2'),
            graphOption('opt3', 'Option 3'),
        ];

        const buildAttribute = (
            attrs: Partial<UserPropertyField['attrs']> = {},
            type = 'graph',
        ): UserPropertyField => ({
            ...customProfileAttribute,
            type,

            // Without this the picker short-circuits to its missing-identity
            // error and makes no request, so "the field is editable" would pass
            // for the wrong reason.
            object_type: 'user',
            attrs: {
                value_type: '',
                visibility: 'when_set',
                sort_order: 0,
                ...attrs,
            },
        } as UserPropertyField);

        type RenderOptions = {
            flagOn?: boolean;
            activeSection?: string;
            saveCustomProfileAttribute?: jest.Mock;
        };

        const renderSettings = (
            attributes: UserPropertyField[],
            values: Record<string, string | string[]> | undefined,
            {flagOn = true, activeSection = SECTION, saveCustomProfileAttribute}: RenderOptions = {},
        ) => {
            const props = {
                ...requiredProps,
                enableCustomProfileAttributes: true,
                customProfileAttributeFields: attributes,
                user: values ? {...user, custom_profile_attributes: values} : {...user},
                activeSection,
                actions: {
                    ...requiredProps.actions,
                    ...(saveCustomProfileAttribute ? {saveCustomProfileAttribute} : {}),
                },
            };

            const view = renderWithContext(<UserSettingsGeneral {...props}/>, {
                entities: {general: {config: {FeatureFlagPropertyFieldGraph: flagOn ? 'true' : 'false'}}},
            });

            return {
                ...view,
                collapse: () => view.rerender(
                    <UserSettingsGeneral
                        {...props}
                        activeSection=''
                    />,
                ),
            };
        };

        const trigger = () => screen.getByTestId('customProfileAttributeGraph_field1');

        // The collapsed row's `describe`, by SettingItem's own id. Read as an
        // element rather than by text: FormattedList collapses to a single
        // "A and B" node here, so the names are not addressable on their own.
        const collapsedRow = () => document.getElementById(`${SECTION}Desc`);

        const openMenu = async () => {
            await userEvent.click(trigger());
            await screen.findByRole('menu');
        };

        // The open popover is a MUI Modal, which aria-hides the rest of the
        // page. Anything outside the menu has to wait for it to close.
        const closeMenu = async () => {
            await userEvent.keyboard('{Escape}');
            await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
        };

        beforeEach(() => {
            // The pager keeps its in-flight walks in module state.
            clearPropertyFieldOptionWalks();
            clearGraphOptionNameCache();

            // A test that forgets to stub the walk must fail loudly rather than
            // fall through to the real Client4 and node-fetch.
            mockPageAll.mockImplementation(() => {
                throw new Error('pageAllAccessControlFieldOptions called without an explicit mock for this test');
            });
        });

        test('A1: lets a graph field with omitted options be edited', async () => {
            mockPageAll.mockResolvedValue(REGIME_1);
            renderSettings([buildAttribute({options_omitted: true, options_count: 1010})], {field1: ['opt1', 'opt2']});

            expect(await screen.findByTestId('customProfileAttributeGraph_field1')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
            expect(screen.queryByText(OMITTED_COPY)).not.toBeInTheDocument();
        });

        test('A2: does not show the options-omitted extra info for a graph field', async () => {
            mockPageAll.mockResolvedValue(REGIME_1);
            renderSettings([buildAttribute({options_omitted: true})], {field1: ['opt1']});

            await screen.findByTestId('customProfileAttributeGraph_field1');
            expect(screen.queryByText(OMITTED_COPY)).not.toBeInTheDocument();

            // The other extraInfo branches still fire for their own fixture.
            expect(screen.getByText('This will be shown in your profile popover.')).toBeInTheDocument();
        });

        test('A3: prefetches once when an omitted graph section is expanded', async () => {
            mockPageAll.mockResolvedValue(REGIME_1);
            const collapsed = renderSettings(
                [buildAttribute({options_omitted: true})],
                {field1: ['opt1']},
                {activeSection: ''},
            );

            await screen.findByText('1 value selected');
            expect(mockPageAll).not.toHaveBeenCalled();
            collapsed.unmount();

            renderSettings([buildAttribute({options_omitted: true})], {field1: ['opt1']});

            await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));
            expect(mockPageAll).toHaveBeenCalledWith(
                {id: 'field1', object_type: 'user'},
                expect.anything(),
            );
        });

        test('A4: shows names in the collapsed row for a hydrated graph field', async () => {
            renderSettings(
                [buildAttribute({options: REGIME_1})],
                {field1: ['opt1', 'opt2']},
                {activeSection: ''},
            );

            await waitFor(() => expect(collapsedRow()).toHaveTextContent('Option 1'));
            expect(collapsedRow()).toHaveTextContent('Option 2');
            expect(collapsedRow()).not.toHaveTextContent('opt1');
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A5: shows a count, not raw ids, in the collapsed row of an omitted graph field', async () => {
            // Regime 3 on first paint: nothing is resolvable yet. This is the
            // degenerate end of the all-or-nothing rule -- with no name
            // resolved, every() and some() agree -- so it covers the
            // first-paint state and A5b/A5c carry the rule itself.
            renderSettings(
                [buildAttribute({options_omitted: true})],
                {field1: ['opt1', 'opt2']},
                {activeSection: ''},
            );

            expect(await screen.findByText('2 values selected')).toBeInTheDocument();
            expect(screen.queryByText('opt1')).not.toBeInTheDocument();
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A5b: shows a count when a stored id is stale and only some names resolve', async () => {
            // The mixed resolution is the only input the all-or-nothing rule
            // exists for: with nothing resolved, or everything resolved, every()
            // and some() agree and cannot be told apart. Here opt1 resolves from
            // the inline options and the stale id resolves from nowhere, so a
            // some() rule would render "Option 1 and undefined" -- the literal
            // word undefined, worse than the id the requirement forbids.
            renderSettings(
                [buildAttribute({options: REGIME_1})],
                {field1: ['opt1', 'ktm3xq7f9nolongerexists']},
                {activeSection: ''},
            );

            expect(await screen.findByText('2 values selected')).toBeInTheDocument();
            expect(collapsedRow()).not.toHaveTextContent('Option 1');
            expect(collapsedRow()).not.toHaveTextContent('undefined');
            expect(collapsedRow()).not.toHaveTextContent('ktm3');
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A5c: shows a count when the walk named only some of the held ids', async () => {
            // The same rule against the other half of the name lookup: the cache
            // rather than the inline options. A held id the walk no longer
            // returns -- a deleted option -- is reported by nothing, so the row
            // must still refuse to print a partial list.
            mockPageAll.mockResolvedValue([graphOption('opt1', 'Option 1')]);
            const {collapse} = renderSettings(
                [buildAttribute({options_omitted: true})],
                {field1: ['opt1', 'opt2']},
            );

            await waitFor(() => expect(trigger()).toHaveTextContent('Option 1'));
            expect(mockPageAll).toHaveBeenCalledTimes(1);

            collapse();

            await waitFor(() => expect(collapsedRow()).toHaveTextContent('2 values selected'));
            expect(collapsedRow()).not.toHaveTextContent('undefined');
        });

        test('A6: shows names in the collapsed row after the section has been expanded once', async () => {
            mockPageAll.mockResolvedValue(REGIME_1);
            const {collapse} = renderSettings(
                [buildAttribute({options_omitted: true})],
                {field1: ['opt1', 'opt2']},
            );

            await waitFor(() => expect(trigger()).toHaveTextContent('Option 1'));
            expect(mockPageAll).toHaveBeenCalledTimes(1);

            collapse();

            await waitFor(() => expect(collapsedRow()).toHaveTextContent('Option 1'));
            expect(collapsedRow()).toHaveTextContent('Option 2');
            expect(collapsedRow()).not.toHaveTextContent('2 values selected');
            expect(collapsedRow()).not.toHaveTextContent('opt1');
            expect(mockPageAll).toHaveBeenCalledTimes(1);
        });

        test('A7: saves option ids, not names', async () => {
            const saveCustomProfileAttribute = jest.fn().mockResolvedValue({data: {}});
            mockPageAll.mockResolvedValue(REGIME_1);
            renderSettings(
                [buildAttribute({options: REGIME_1})],
                {field1: ['opt1']},
                {saveCustomProfileAttribute},
            );

            await openMenu();
            await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'Option 3'}));
            await closeMenu();

            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt1', 'opt3']);
        });

        test('A8: saves an empty array when the last value is unchecked', async () => {
            const saveCustomProfileAttribute = jest.fn().mockResolvedValue({data: {}});
            mockPageAll.mockResolvedValue(REGIME_1);
            renderSettings(
                [buildAttribute({options: REGIME_1})],
                {field1: ['opt1']},
                {saveCustomProfileAttribute},
            );

            await openMenu();
            const row = await screen.findByRole('menuitemcheckbox', {name: 'Option 1'});
            expect(row).toHaveAttribute('aria-checked', 'true');
            await userEvent.click(row);
            await closeMenu();

            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', []);
        });

        test('A9: keeps an admin-managed graph field read-only', async () => {
            renderSettings(
                [buildAttribute({options_omitted: true, managed: 'admin'})],
                {field1: ['opt1']},
            );

            expect(await screen.findByText('This field can only be changed by an administrator.')).toBeInTheDocument();
            expect(screen.queryByTestId('customProfileAttributeGraph_field1')).not.toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A10: keeps synced, owner-managed and protected graph fields read-only', async () => {
            const cases: Array<[Partial<UserPropertyField['attrs']>, string, Partial<UserProfile>]> = [
                [{ldap: 'dept'}, 'This field is handled through your login provider. If you want to change it, you need to do so through your login provider.', {auth_service: 'ldap'}],
                [{owners: [{id: 'plugin.x', type: 'plugin', scopes: []}]}, 'This field is managed by an external integration and cannot be edited here.', {}],
                [{protected: true, access_mode: 'shared_only', source_plugin_id: 'plugin.x'}, 'This field is managed by a plugin and cannot be edited.', {}],
            ];

            for (const [attrs, copy, userOverrides] of cases) {
                const props = {
                    ...requiredProps,
                    enableCustomProfileAttributes: true,
                    customProfileAttributeFields: [buildAttribute({options_omitted: true, ...attrs})],
                    user: {...user, ...userOverrides, custom_profile_attributes: {field1: ['opt1']}},
                    activeSection: SECTION,
                };

                const view = renderWithContext(<UserSettingsGeneral {...props}/>, {
                    entities: {general: {config: {FeatureFlagPropertyFieldGraph: 'true'}}},
                });

                // Substring: the protected copy is followed by a sibling
                // "(pluginId)" node, so no element holds it exactly.
                // eslint-disable-next-line no-await-in-loop
                expect(await screen.findByText(copy, {exact: false})).toBeInTheDocument();
                expect(screen.queryByTestId('customProfileAttributeGraph_field1')).not.toBeInTheDocument();
                expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
                expect(screen.queryByText(OMITTED_COPY)).not.toBeInTheDocument();

                view.unmount();
            }

            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A11: keeps a select field with omitted options read-only', async () => {
            renderSettings([buildAttribute({options_omitted: true}, 'select')], {field1: 'opt1'});

            expect(await screen.findByText(OMITTED_COPY)).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A12: keeps a multiselect field with omitted options read-only', async () => {
            renderSettings([buildAttribute({options_omitted: true}, 'multiselect')], {field1: ['opt1']});

            expect(await screen.findByText(OMITTED_COPY)).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A13: hides a source_only field', async () => {
            renderSettings(
                [
                    buildAttribute({options: REGIME_1, access_mode: 'source_only'}),
                    {...buildAttribute({options: REGIME_1}), id: 'field2', name: 'Visible Field'} as UserPropertyField,
                ],
                {field1: ['opt1'], field2: ['opt1']},
                {activeSection: ''},
            );

            // Anchored on a sibling that must render, so the absences below are
            // the access-mode filter rather than the whole list failing to
            // paint. A negative assertion on its own would pass either way.
            expect(await screen.findByText('Visible Field')).toBeInTheDocument();
            expect(screen.queryByText(customProfileAttribute.name)).not.toBeInTheDocument();
            expect(screen.queryByTestId('customProfileAttributeGraph_field1')).not.toBeInTheDocument();
        });

        test('A14: shows a shared_only graph field read-only rather than hiding it', async () => {
            renderSettings(
                [buildAttribute({protected: true, access_mode: 'shared_only', source_plugin_id: 'plugin.x'})],
                {field1: ['opt1']},
                {activeSection: ''},
            );

            expect(await screen.findByText(customProfileAttribute.name)).toBeInTheDocument();
            expect(screen.queryByTestId('customProfileAttributeGraph_field1')).not.toBeInTheDocument();
        });

        test('A15: keeps a read_only option selectable', async () => {
            const saveCustomProfileAttribute = jest.fn().mockResolvedValue({data: {}});
            mockPageAll.mockResolvedValue(REGIME_1.map((option) => ({...option, read_only: true})));
            renderSettings(
                [buildAttribute({options_omitted: true})],
                undefined,
                {saveCustomProfileAttribute},
            );

            await openMenu();
            const row = await screen.findByRole('menuitemcheckbox', {name: 'Option 2'});
            expect(row).toHaveAttribute('aria-checked', 'false');
            await userEvent.click(row);
            expect(screen.getByRole('menuitemcheckbox', {name: 'Option 2'})).toHaveAttribute('aria-checked', 'true');
            await closeMenu();

            await userEvent.click(screen.getByRole('button', {name: 'Save'}));

            expect(saveCustomProfileAttribute).toHaveBeenCalledWith('user_id', 'field1', ['opt2']);
        });

        test('A16: shows an error with Retry, not a locked field, when the walk fails', async () => {
            mockPageAll.mockRejectedValue(new Error('boom'));
            renderSettings([buildAttribute({options_omitted: true})], {field1: ['opt1']});

            await openMenu();

            expect(await screen.findByText('These values could not be loaded.')).toBeInTheDocument();
            expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
            await closeMenu();

            expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
            expect(screen.queryByText(OMITTED_COPY)).not.toBeInTheDocument();
        });

        test('A19: shows a count, never ids, for a read-only omitted graph field', async () => {
            // M3's cost, pinned rather than left implicit. The section is
            // EXPANDED first, which is the whole point: for an editable field
            // that is when the picker mounts and names arrive, so a count here
            // would be temporary. A read-only field renders no control, so no
            // picker mounts, no walk runs, the summary does not walk for a read-only omitted field,
            // and the count is permanent -- where the same field on User Detail
            // shows names. Still better than the flag-off path, which prints the
            // ids themselves.
            //
            // Asserted through expansion deliberately. Pinned from the collapsed
            // state alone this test passes whether or not the field is read-only,
            // and so cannot fail if someone deletes the isReadOnly gate.
            const {collapse} = renderSettings(
                [buildAttribute({options_omitted: true, managed: 'admin'})],
                {field1: ['opt1', 'opt2']},
            );

            // Expanded, and expanded as a read-only field: the admin notice only
            // renders in SettingItemMax, and no picker sits beside it.
            expect(await screen.findByText('This field can only be changed by an administrator.')).toBeInTheDocument();
            expect(screen.queryByTestId('customProfileAttributeGraph_field1')).not.toBeInTheDocument();
            expect(mockPageAll).not.toHaveBeenCalled();

            collapse();

            expect(await screen.findByText('2 values selected')).toBeInTheDocument();
            expect(collapsedRow()).not.toHaveTextContent('opt1');
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A17: renders today\'s ReactSelect for a graph field when the flag is off', async () => {
            renderSettings(
                [buildAttribute({options: REGIME_1})],
                {field1: []},
                {flagOn: false},
            );

            expect(await screen.findByText('Select')).toBeInTheDocument();
            expect(screen.queryByTestId('customProfileAttributeGraph_field1')).not.toBeInTheDocument();
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A18: keeps an omitted graph field read-only when the flag is off', async () => {
            renderSettings(
                [buildAttribute({options_omitted: true})],
                {field1: ['opt1', 'opt2']},
                {flagOn: false},
            );

            expect(await screen.findByText(OMITTED_COPY)).toBeInTheDocument();
            expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
            expect(screen.queryByTestId('customProfileAttributeGraph_field1')).not.toBeInTheDocument();
            expect(mockPageAll).not.toHaveBeenCalled();
        });

        test('A20: flag-off omitted graph field prints ids in the collapsed row', async () => {
            const {collapse} = renderSettings(
                [buildAttribute({options_omitted: true})],
                {field1: ['opt1', 'opt2']},
                {flagOn: false},
            );

            await screen.findByText(OMITTED_COPY);
            collapse();

            expect(await screen.findByText(/opt1/)).toBeInTheDocument();
            expect(collapsedRow()).toHaveTextContent('opt1');
            expect(screen.queryByText('2 values selected')).not.toBeInTheDocument();
        });

        test('A21: collapsed omitted multiselect prints ids, never a graph count', async () => {
            const {collapse} = renderSettings(
                [buildAttribute({options_omitted: true}, 'multiselect')],
                {field1: ['opt1', 'opt2']},
            );

            await screen.findByText(OMITTED_COPY);
            collapse();

            expect(await screen.findByText(/opt1/)).toBeInTheDocument();
            expect(collapsedRow()).toHaveTextContent('opt1');
            expect(screen.queryByText('2 values selected')).not.toBeInTheDocument();
        });
    });
});
