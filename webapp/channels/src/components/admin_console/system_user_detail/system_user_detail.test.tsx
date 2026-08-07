// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import '@testing-library/jest-dom';

import {fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type {IntlShape} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import SystemUserDetail, {getUserAuthenticationTextField} from 'components/admin_console/system_user_detail/system_user_detail';
import type {Params, Props} from 'components/admin_console/system_user_detail/system_user_detail';

import type {MockIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen, waitFor, waitForElementToBeRemoved} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

// Mock user profile data
const user = Object.assign(TestHelper.getUserMock(), {auth_service: ''}) as UserProfile;
const ldapUser = {...user, auth_service: Constants.LDAP_SERVICE} as UserProfile;

// Mock getUser action result
const getUserMock = jest.fn().mockResolvedValue({data: user, error: null});
const getLdapUserMock = jest.fn().mockResolvedValue({data: ldapUser, error: null});

describe('SystemUserDetail', () => {
    const defaultProps: Props = {
        currentUserId: 'current_user_id',
        showManageUserSettings: false,
        showLockedManageUserSettings: false,
        mfaEnabled: false,
        maxFileSize: 1024 * 1024,
        ldapPictureAttributeSet: false,
        customProfileAttributeEnabled: true,
        customProfileAttributeFields: [],
        patchUser: jest.fn(),
        updateUserAuth: jest.fn(),
        updateUserMfa: jest.fn(),
        getUser: getUserMock,
        updateUserActive: jest.fn(),
        setNavigationBlocked: jest.fn(),
        addUserToTeam: jest.fn(),
        openModal: jest.fn(),
        getUserPreferences: jest.fn(),
        getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: []}),
        getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {}}),
        saveCustomProfileAttribute: jest.fn().mockResolvedValue({data: {}}),
        uploadProfileImage: jest.fn().mockResolvedValue({data: true}),
        setDefaultProfileImage: jest.fn().mockResolvedValue({data: true}),
        intl: {
            formatMessage: jest.fn().mockImplementation(({defaultMessage}) => defaultMessage),
        } as MockIntl,
        ...({
            match: {
                params: {
                    user_id: 'user_id',
                },
            },
        } as RouteComponentProps<Params>),
    };

    const waitForLoadingToFinish = async () => {
        await waitForElementToBeRemoved(screen.queryAllByTitle('Loading Icon'));
        await waitFor(() => expect(screen.queryByText('No teams found')).toBeInTheDocument());
    };

    test('should match default snapshot', async () => {
        const props = defaultProps;
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish();

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot if MFA is enabled', async () => {
        const props = {
            ...defaultProps,
            mfaEnabled: true,
        };
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish();

        expect(container).toMatchSnapshot();
    });

    test('should show manage user settings button as activated', async () => {
        const props = {
            ...defaultProps,
            showManageUserSettings: true,
        };
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish();

        expect(container).toMatchSnapshot();
    });

    test('should show manage user settings button as disabled when no license', async () => {
        const props = {
            ...defaultProps,
            showLockedManageUserSettings: false,
        };
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish();

        expect(container).toMatchSnapshot();
    });

    test('should show the activate user button as disabled when user is LDAP', async () => {
        const props = {
            ...defaultProps,
            getUser: getLdapUserMock,
        };

        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish();

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

        await waitForLoadingToFinish();

        expect(container).toMatchSnapshot();
    });

    test('should not fetch CPA data if disabled', async () => {
        const getCustomProfileAttributeFields = jest.fn().mockResolvedValue({data: []});
        const getCustomProfileAttributeValues = jest.fn().mockResolvedValue({data: {}});

        const props = {
            ...defaultProps,
            customProfileAttributeEnabled: false,
            getCustomProfileAttributeFields,
            getCustomProfileAttributeValues,
        };
        const {container} = renderWithContext(<SystemUserDetail {...props}/>);

        await waitForLoadingToFinish();

        expect(getCustomProfileAttributeFields).not.toHaveBeenCalled();
        expect(getCustomProfileAttributeValues).not.toHaveBeenCalled();

        expect(container).toMatchSnapshot();
    });

    describe('change detection', () => {
        test('should detect email changes and enable save', async () => {
            const userEventInstance = userEvent.setup();
            renderWithContext(<SystemUserDetail {...defaultProps}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const emailInput = screen.getByLabelText('Email');
            await userEventInstance.clear(emailInput);
            await userEventInstance.type(emailInput, 'newemail@example.com');
            expect(defaultProps.setNavigationBlocked).toHaveBeenCalledWith(true);
        });

        test('should detect username changes and enable save', async () => {
            const userEventInstance = userEvent.setup();
            renderWithContext(<SystemUserDetail {...defaultProps}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const usernameInput = screen.getByPlaceholderText('Enter username');
            await userEventInstance.clear(usernameInput);
            await userEventInstance.type(usernameInput, 'newusername');
            expect(defaultProps.setNavigationBlocked).toHaveBeenCalledWith(true);
        });

        test.each([
            ['first name', 'Enter first name'],
            ['last name', 'Enter last name'],
        ])('should detect %s changes and enable save', async (_fieldName, placeholder) => {
            const userEventInstance = userEvent.setup();
            const setNavigationBlocked = jest.fn();
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    setNavigationBlocked={setNavigationBlocked}
                />,
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const input = screen.getByPlaceholderText(placeholder);
            await userEventInstance.clear(input);
            await userEventInstance.type(input, 'New Name');

            expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
            expect(setNavigationBlocked).toHaveBeenCalledWith(true);
        });
    });

    describe('name editing', () => {
        const nameUser = {
            ...user,
            first_name: 'Old First',
            last_name: 'Old Last',
        };

        test('should show name changes, trim values, and patch the user on save', async () => {
            const userEventInstance = userEvent.setup();
            const getNameUser = jest.fn().mockResolvedValue({data: nameUser, error: null});
            const patchUser = jest.fn().mockImplementation((updatedUser: UserProfile) => Promise.resolve({data: updatedUser, error: null}));
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    getUser={getNameUser}
                    patchUser={patchUser}
                />,
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const firstNameInput = screen.getByPlaceholderText('Enter first name');
            const lastNameInput = screen.getByPlaceholderText('Enter last name');
            await userEventInstance.clear(firstNameInput);
            await userEventInstance.type(firstNameInput, '  New First  ');
            await userEventInstance.clear(lastNameInput);
            await userEventInstance.type(lastNameInput, '  New Last  ');
            await userEventInstance.click(screen.getByRole('button', {name: 'Save'}));

            const changesList = await screen.findByTestId('changesList');
            expect(changesList).toHaveTextContent('First Name: Old First → New First');
            expect(changesList).toHaveTextContent('Last Name: Old Last → New Last');

            await userEventInstance.click(screen.getByRole('button', {name: 'Save Changes'}));

            await waitFor(() => {
                expect(patchUser).toHaveBeenCalledWith(expect.objectContaining({
                    first_name: 'New First',
                    last_name: 'New Last',
                }));
            });
        });

        test('should translate empty values in the name change summary', async () => {
            const userEventInstance = userEvent.setup();
            const getNameUser = jest.fn().mockResolvedValue({data: nameUser, error: null});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    getUser={getNameUser}
                />,
                {},
                {
                    intlMessages: {
                        'admin.userDetail.saveChangesModal.empty': '(translated empty)',
                    },
                },
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            await userEventInstance.clear(screen.getByPlaceholderText('Enter first name'));
            await userEventInstance.click(screen.getByRole('button', {name: 'Save'}));

            expect(await screen.findByTestId('changesList')).toHaveTextContent('First Name: Old First → (translated empty)');
        });

        test('should reset first and last names on cancel', async () => {
            const userEventInstance = userEvent.setup();
            const getNameUser = jest.fn().mockResolvedValue({data: nameUser, error: null});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    getUser={getNameUser}
                />,
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const firstNameInput = screen.getByPlaceholderText('Enter first name');
            const lastNameInput = screen.getByPlaceholderText('Enter last name');
            await userEventInstance.clear(firstNameInput);
            await userEventInstance.type(firstNameInput, 'New First');
            await userEventInstance.clear(lastNameInput);
            await userEventInstance.type(lastNameInput, 'New Last');
            await userEventInstance.click(screen.getByRole('button', {name: 'Cancel'}));

            expect(firstNameInput).toHaveValue('Old First');
            expect(lastNameInput).toHaveValue('Old Last');
            expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled();
        });
    });

    describe('profile picture editing', () => {
        test('should upload a selected profile picture on behalf of the user and enable removal', async () => {
            const uploadProfileImage = jest.fn().mockResolvedValue({data: true});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    uploadProfileImage={uploadProfileImage}
                />,
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const file = new File(['image-bytes'], 'avatar.png', {type: 'image/png'});
            fireEvent.change(screen.getByTestId('adminUserCardPictureInput'), {target: {files: [file]}});

            await waitFor(() => {
                expect(uploadProfileImage).toHaveBeenCalledWith(user.id, file);
            });

            // After a successful upload the user now has a custom picture, so removal becomes available.
            await userEvent.click(screen.getByTestId('adminUserCardPictureButton'));
            expect(await screen.findByText('Remove Picture')).toBeInTheDocument();
        });

        test('should surface a server error when the upload fails', async () => {
            const uploadProfileImage = jest.fn().mockResolvedValue({error: {message: 'Server rejected image'}});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    uploadProfileImage={uploadProfileImage}
                />,
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const file = new File(['image-bytes'], 'avatar.png', {type: 'image/png'});
            fireEvent.change(screen.getByTestId('adminUserCardPictureInput'), {target: {files: [file]}});

            expect(await screen.findByText('Server rejected image')).toBeInTheDocument();

            // The edit control should be usable again after the failure.
            expect(screen.getByTestId('adminUserCardPictureButton')).toBeEnabled();
        });

        test('should reject an unsupported image type without uploading', async () => {
            const uploadProfileImage = jest.fn().mockResolvedValue({data: true});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    uploadProfileImage={uploadProfileImage}
                />,
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const file = new File(['image-bytes'], 'avatar.gif', {type: 'image/gif'});
            fireEvent.change(screen.getByTestId('adminUserCardPictureInput'), {target: {files: [file]}});

            expect(await screen.findByText('Only BMP, JPG, JPEG, or PNG images are supported.')).toBeInTheDocument();
            expect(uploadProfileImage).not.toHaveBeenCalled();
        });

        test('should reject a file that exceeds the maximum size without uploading', async () => {
            const uploadProfileImage = jest.fn().mockResolvedValue({data: true});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    maxFileSize={4}
                    uploadProfileImage={uploadProfileImage}
                />,
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const file = new File(['too-many-bytes'], 'avatar.png', {type: 'image/png'});
            fireEvent.change(screen.getByTestId('adminUserCardPictureInput'), {target: {files: [file]}});

            expect(await screen.findByText(/File is too large/)).toBeInTheDocument();
            expect(uploadProfileImage).not.toHaveBeenCalled();
        });

        test('should reset the picture to default when removing and hide the removal option', async () => {
            const userWithPicture = {...user, last_picture_update: 12345};
            const getUserWithPicture = jest.fn().mockResolvedValue({data: userWithPicture, error: null});
            const setDefaultProfileImage = jest.fn().mockResolvedValue({data: true});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    getUser={getUserWithPicture}
                    setDefaultProfileImage={setDefaultProfileImage}
                />,
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            await userEvent.click(screen.getByTestId('adminUserCardPictureButton'));
            await userEvent.click(screen.getByText('Remove Picture'));

            await waitFor(() => {
                expect(setDefaultProfileImage).toHaveBeenCalledWith(user.id);
            });

            // The user no longer has a custom picture, so removal is no longer offered.
            await userEvent.click(screen.getByTestId('adminUserCardPictureButton'));
            expect(await screen.findByText('Upload Picture')).toBeInTheDocument();
            expect(screen.queryByText('Remove Picture')).not.toBeInTheDocument();
        });

        test('should surface a server error when removal fails', async () => {
            const userWithPicture = {...user, last_picture_update: 12345};
            const getUserWithPicture = jest.fn().mockResolvedValue({data: userWithPicture, error: null});
            const setDefaultProfileImage = jest.fn().mockResolvedValue({error: {message: 'Server rejected removal'}});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    getUser={getUserWithPicture}
                    setDefaultProfileImage={setDefaultProfileImage}
                />,
            );

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            await userEvent.click(screen.getByTestId('adminUserCardPictureButton'));
            await userEvent.click(screen.getByText('Remove Picture'));

            expect(await screen.findByText('Server rejected removal')).toBeInTheDocument();

            // The edit control should be usable again after the failure.
            expect(screen.getByTestId('adminUserCardPictureButton')).toBeEnabled();
        });

        test('should not offer picture editing for provider-managed pictures', async () => {
            const getLdapUser = jest.fn().mockResolvedValue({data: ldapUser, error: null});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    getUser={getLdapUser}
                    ldapPictureAttributeSet={true}
                />,
            );

            await waitForLoadingToFinish();

            expect(screen.queryByTestId('adminUserCardPictureButton')).not.toBeInTheDocument();
        });

        test('should offer picture editing for provider users when the picture is not synced', async () => {
            const getLdapUser = jest.fn().mockResolvedValue({data: ldapUser, error: null});
            renderWithContext(
                <SystemUserDetail
                    {...defaultProps}
                    getUser={getLdapUser}
                    ldapPictureAttributeSet={false}
                />,
            );

            await waitForLoadingToFinish();

            expect(screen.getByTestId('adminUserCardPictureButton')).toBeInTheDocument();
        });
    });

    describe('email validation', () => {
        test('should handle email validation and still set navigation blocking', async () => {
            const userEventInstance = userEvent.setup();
            renderWithContext(<SystemUserDetail {...defaultProps}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const emailInput = screen.getByLabelText('Email');
            await userEventInstance.clear(emailInput);
            await userEventInstance.type(emailInput, 'invalid-email');

            // Navigation should still be blocked even with invalid email
            expect(defaultProps.setNavigationBlocked).toHaveBeenCalledWith(true);
        });

        test('should not show validation error for valid email', async () => {
            const userEventInstance = userEvent.setup();
            renderWithContext(<SystemUserDetail {...defaultProps}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const emailInput = screen.getByLabelText('Email');
            await userEventInstance.clear(emailInput);
            await userEventInstance.type(emailInput, 'valid@email.com');

            await waitFor(() => {
                expect(screen.queryByText('Invalid email address')).not.toBeInTheDocument();
            });
        });

        test('should show validation error for empty email', async () => {
            const userEventInstance = userEvent.setup();
            renderWithContext(<SystemUserDetail {...defaultProps}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const emailInput = screen.getByLabelText('Email');
            await userEventInstance.clear(emailInput);
            await userEventInstance.type(emailInput, '  ');

            await waitFor(() => {
                expect(screen.getByText('Email cannot be empty')).toBeInTheDocument();
            });
        });
    });

    describe('username validation', () => {
        test('should show validation error for empty username', async () => {
            const userEventInstance = userEvent.setup();
            renderWithContext(<SystemUserDetail {...defaultProps}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const usernameInput = screen.getByPlaceholderText('Enter username');
            await userEventInstance.clear(usernameInput);
            await userEventInstance.type(usernameInput, '  ');

            await waitFor(() => {
                expect(screen.getByText('Username cannot be empty')).toBeInTheDocument();
            });
        });
    });

    describe('authData validation', () => {
        const samlUser = {...user, auth_service: Constants.SAML_SERVICE, auth_data: 'test-auth-data'} as UserProfile;
        const getSamlUserMock = jest.fn().mockResolvedValue({data: samlUser, error: null});

        test('should show validation error for empty authData', async () => {
            const userEventInstance = userEvent.setup();
            const props = {
                ...defaultProps,
                getUser: getSamlUserMock,
            };
            renderWithContext(<SystemUserDetail {...props}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const authDataInput = screen.getByPlaceholderText('Enter auth data');
            await userEventInstance.clear(authDataInput);
            await userEventInstance.type(authDataInput, '  ');

            await waitFor(() => {
                expect(screen.getByText('Auth Data cannot be empty')).toBeInTheDocument();
            });
        });

        test('should show validation error for authData exceeding 128 characters', async () => {
            const userEventInstance = userEvent.setup();
            const props = {
                ...defaultProps,
                getUser: getSamlUserMock,
            };
            renderWithContext(<SystemUserDetail {...props}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const authDataInput = screen.getByPlaceholderText('Enter auth data');
            const longAuthData = 'a'.repeat(129); // 129 characters, exceeds max
            await userEventInstance.clear(authDataInput);
            await userEventInstance.type(authDataInput, longAuthData);

            await waitFor(() => {
                expect(screen.getByText('Auth Data must be 128 characters or less')).toBeInTheDocument();
            });
        });

        test('should not show validation error for valid authData', async () => {
            const userEventInstance = userEvent.setup();
            const props = {
                ...defaultProps,
                getUser: getSamlUserMock,
            };
            renderWithContext(<SystemUserDetail {...props}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            const authDataInput = screen.getByPlaceholderText('Enter auth data');
            const validAuthData = 'a'.repeat(128); // Exactly 128 characters
            await userEventInstance.clear(authDataInput);
            await userEventInstance.type(authDataInput, validAuthData);

            await waitFor(() => {
                expect(screen.queryByText('Auth Data must be 128 characters or less')).not.toBeInTheDocument();
                expect(screen.queryByText('Auth Data cannot be empty')).not.toBeInTheDocument();
            });
        });
    });

    describe('error handling', () => {
        test('should handle getUser error correctly', async () => {
            // Suppress expected console errors
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const getUserErrorMock = jest.fn().mockResolvedValue({
                data: null,
                error: {message: 'User not found'},
            });

            const props = {
                ...defaultProps,
                getUser: getUserErrorMock,
            };

            renderWithContext(<SystemUserDetail {...props}/>);

            await waitFor(() => {
                expect(screen.getByText('Cannot load User')).toBeInTheDocument();
            });

            consoleSpy.mockRestore();
        });

        test('should handle updateUserActive error correctly', async () => {
            const userEventInstance = userEvent.setup();

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
            };

            renderWithContext(<SystemUserDetail {...props}/>);

            await waitForElementToBeRemoved(() => screen.queryAllByTestId('loadingSpinner'));

            // Find and click activate button
            const activateButton = screen.getByText('Activate');
            await userEventInstance.click(activateButton);

            await waitFor(() => {
                expect(screen.getByText('Activation failed')).toBeInTheDocument();
            });

            consoleSpy.mockRestore();
        });
    });

    describe('CPA field labels', () => {
        const buildCPAField = (overrides: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
            id: 'cpa-1',
            name: 'department',
            type: 'text',
            group_id: 'custom_profile_attributes',
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
                ...overrides,
            },
        });

        test('should render CPA label using display_name', async () => {
            const cpaField = buildCPAField({display_name: 'Engineering Department'});
            const props = {
                ...defaultProps,
                customProfileAttributeFields: [cpaField],
                getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: [cpaField]}),
            };

            renderWithContext(<SystemUserDetail {...props}/>);

            await waitForLoadingToFinish();

            const labelEl = await screen.findByTestId('user-detail-custom-attribute-label-cpa-1');
            expect(labelEl).toHaveTextContent('Engineering Department');
            expect(labelEl).not.toHaveTextContent('department');
        });

        test('should fall back to name when display_name is empty', async () => {
            const cpaField = buildCPAField({display_name: ''});
            const props = {
                ...defaultProps,
                customProfileAttributeFields: [cpaField],
                getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: [cpaField]}),
            };

            renderWithContext(<SystemUserDetail {...props}/>);

            await waitForLoadingToFinish();

            const labelEl = await screen.findByTestId('user-detail-custom-attribute-label-cpa-1');
            expect(labelEl).toHaveTextContent('department');
        });

        test('should show owner management indicator for owner-managed CPA field', async () => {
            const cpaField = buildCPAField({
                owners: [{id: 'com.mattermost.scim', type: 'plugin', scopes: ['entra']}],
            });
            const props = {
                ...defaultProps,
                customProfileAttributeFields: [cpaField],
                getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: [cpaField]}),
            };

            renderWithContext(<SystemUserDetail {...props}/>);

            await waitForLoadingToFinish();

            expect(screen.getByTestId('user-detail-cpa-field__owner-department-com.mattermost.scim')).toHaveTextContent('com.mattermost.scim: entra');
            expect(screen.getByText('Synced with:')).toBeInTheDocument();

            const input = screen.getByTestId('user-detail-custom-attribute-label-cpa-1').querySelector('input');
            expect(input).toBeDisabled();
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
