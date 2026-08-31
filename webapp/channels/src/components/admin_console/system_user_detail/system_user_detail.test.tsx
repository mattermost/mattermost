// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import '@testing-library/jest-dom';

import userEvent from '@testing-library/user-event';
import React from 'react';
import type {IntlShape} from 'react-intl';
import type {RouteComponentProps} from 'react-router-dom';

import type {UserPropertyField} from '@mattermost/types/properties_user';
import type {UserProfile} from '@mattermost/types/users';

import SystemUserDetail, {getUserAuthenticationTextField} from 'components/admin_console/system_user_detail/system_user_detail';
import type {Params, Props} from 'components/admin_console/system_user_detail/system_user_detail';
import {clearPropertyFieldOptionWalks, pageAllPropertyFieldOptions} from 'components/property_fields/page_all_property_field_options';

import type {MockIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen, waitFor, waitForElementToBeRemoved, within} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

jest.mock('components/property_fields/page_all_property_field_options', () => ({
    ...jest.requireActual('components/property_fields/page_all_property_field_options'),
    pageAllPropertyFieldOptions: jest.fn(),
}));

const mockPageAll = jest.mocked(pageAllPropertyFieldOptions);

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
        customProfileAttributeEnabled: true,
        customProfileAttributeFields: [],
        isGraphPickerEnabled: false,
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

            // The picker short-circuits to its missing-identity error without
            // this, and every "the field is editable" assertion below would pass
            // for the wrong reason.
            object_type: 'user',
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

        test('should render a graph field\'s stored option ids as names in the flag-off multiselect', async () => {
            const graphField = {
                ...buildCPAField({
                    options: [
                        {id: 'opt-1', name: 'Alpha'},
                        {id: 'opt-2', name: 'Beta'},
                    ],
                }),
                type: 'graph',
            } as UserPropertyField;
            const props = {
                ...defaultProps,
                customProfileAttributeFields: [graphField],
                getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: [graphField]}),
                getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {[graphField.id]: ['opt-1', 'opt-2']}}),
            };

            renderWithContext(<SystemUserDetail {...props}/>);

            await waitForLoadingToFinish();

            const fieldContainer = screen.getByTestId('user-detail-custom-attribute-label-cpa-1');
            expect(fieldContainer).toHaveTextContent('Alpha');
            expect(fieldContainer).toHaveTextContent('Beta');
            expect(fieldContainer).not.toHaveTextContent('opt-1');
            expect(fieldContainer).not.toHaveTextContent('opt-2');
        });

        test('should resolve graph field option ids to names in the change summary', async () => {
            const userEventInstance = userEvent.setup();
            const graphField = {
                ...buildCPAField({
                    options: [
                        {id: 'opt-1', name: 'Alpha'},
                        {id: 'opt-2', name: 'Beta'},
                        {id: 'opt-3', name: 'Gamma'},
                    ],
                }),
                type: 'graph',
            } as UserPropertyField;
            const props = {
                ...defaultProps,
                customProfileAttributeFields: [graphField],
                getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: [graphField]}),
                getCustomProfileAttributeValues: jest.fn().mockResolvedValue({data: {[graphField.id]: ['opt-1', 'opt-2']}}),
            };

            renderWithContext(<SystemUserDetail {...props}/>);

            await waitForLoadingToFinish();

            const fieldContainer = screen.getByTestId('user-detail-custom-attribute-label-cpa-1');
            const picker = within(fieldContainer).getByRole('combobox');
            await userEventInstance.click(picker);
            await userEventInstance.click(await screen.findByText('Gamma'));

            await userEventInstance.click(screen.getByRole('button', {name: 'Save'}));

            const changesList = await screen.findByTestId('changesList');
            expect(changesList).toHaveTextContent('Alpha, Beta, Gamma');
            expect(changesList).not.toHaveTextContent('opt-1');
            expect(changesList).not.toHaveTextContent('opt-2');
            expect(changesList).not.toHaveTextContent('opt-3');
        });

        describe('graph omit-unlock', () => {
            const OMITTED_COPY = 'This field has too many options to be edited here.';

            const graphOption = (id: string, name: string, parents: string[] = []) => ({
                id, name, parents, create_at: 1,
            });

            // Regime 1: a small field that inlines every option.
            const REGIME_1 = [
                graphOption('opt-1', 'Alpha'),
                graphOption('opt-2', 'Beta'),
                graphOption('opt-3', 'Gamma'),
                graphOption('opt-4', 'Delta'),
                graphOption('opt-5', 'Epsilon'),
            ];

            // Regime 2: 201-1000 options, still inlined in full, carrying
            // neither options_omitted nor options_count.
            const REGIME_2 = Array.from(
                {length: 300},
                (_, index) => graphOption(`big-${index}`, `Big ${index}`),
            );

            const buildGraphField = (overrides: Partial<UserPropertyField['attrs']> = {}) => ({
                ...buildCPAField(overrides),
                type: 'graph',
            } as UserPropertyField);

            const renderDetail = (
                field: UserPropertyField,
                values: string | string[] | undefined,
                {flagOn = true, propOverrides = {}}: {flagOn?: boolean; propOverrides?: Partial<Props>} = {},
            ) => {
                const props = {
                    ...defaultProps,
                    isGraphPickerEnabled: flagOn,
                    customProfileAttributeFields: [field],
                    getCustomProfileAttributeFields: jest.fn().mockResolvedValue({data: [field]}),
                    getCustomProfileAttributeValues: jest.fn().mockResolvedValue({
                        data: values ? {[field.id]: values} : {},
                    }),
                    ...propOverrides,
                };

                return renderWithContext(<SystemUserDetail {...props}/>, {
                    entities: {general: {config: {FeatureFlagPropertyFieldGraph: flagOn ? 'true' : 'false'}}},
                });
            };

            const fieldContainer = () => screen.getByTestId('user-detail-custom-attribute-label-cpa-1');
            const trigger = () => screen.getByTestId('cpa-graph-select-cpa-1');

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

                // A test that forgets to stub the walk must fail loudly rather
                // than fall through to the real Client4 and node-fetch.
                mockPageAll.mockImplementation(() => {
                    throw new Error('pageAllPropertyFieldOptions called without an explicit mock for this test');
                });
            });

            test('G1: renders an omitted graph field as an editable picker, not a disabled id input', async () => {
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options_omitted: true, options_count: 1010}), ['opt-1', 'opt-2']);

                await waitForLoadingToFinish();

                await waitFor(() => expect(trigger()).toHaveTextContent('Alpha'));
                expect(trigger()).toHaveTextContent('Beta');
                expect(trigger()).not.toHaveTextContent('opt-1');
                expect(fieldContainer().querySelector('input:disabled')).toBeNull();
                expect(fieldContainer()).not.toHaveTextContent(OMITTED_COPY);
            });

            test('G2: prefetches an omitted graph field\'s options once on mount', async () => {
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options_omitted: true}), ['opt-1']);

                await waitForLoadingToFinish();

                await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));
                expect(mockPageAll).toHaveBeenCalledWith(
                    {id: 'cpa-1', object_type: 'user'},
                    expect.anything(),
                );
            });

            test('G3: does not prefetch a hydrated graph field whose options name every held value', async () => {
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options: REGIME_1}), ['opt-1', 'opt-3']);

                await waitForLoadingToFinish();
                await waitFor(() => expect(trigger()).toHaveTextContent('Alpha'));

                expect(mockPageAll).not.toHaveBeenCalled();
            });

            test('G3b: does not prefetch a 300-option graph field with no omission markers', async () => {
                mockPageAll.mockResolvedValue(REGIME_2);
                renderDetail(buildGraphField({options: REGIME_2}), ['big-7']);

                await waitForLoadingToFinish();
                await waitFor(() => expect(trigger()).toHaveTextContent('Big 7'));

                expect(mockPageAll).not.toHaveBeenCalled();
            });

            test('G4: prefetches a hydrated graph field holding an id its options do not name', async () => {
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options: REGIME_1}), ['opt-1', 'ghost']);

                await waitForLoadingToFinish();

                await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));
            });

            test('G5: shows an error with Retry when the option walk fails, and does not fall back to a disabled id input', async () => {
                mockPageAll.mockRejectedValue(new Error('boom'));
                renderDetail(buildGraphField({options_omitted: true}), ['opt-1', 'opt-2']);

                await waitForLoadingToFinish();
                await openMenu();

                expect(await screen.findByText('These values could not be loaded.')).toBeInTheDocument();
                expect(fieldContainer().querySelector('input:disabled')).toBeNull();
                expect(fieldContainer()).not.toHaveTextContent(OMITTED_COPY);

                const callsBeforeRetry = mockPageAll.mock.calls.length;
                mockPageAll.mockResolvedValue(REGIME_1);
                await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

                expect(await screen.findByRole('menuitemcheckbox', {name: 'Alpha'})).toBeInTheDocument();
                expect(mockPageAll.mock.calls.length).toBe(callsBeforeRetry + 1);
            });

            test('G6: keeps a read_only option selectable', async () => {
                mockPageAll.mockResolvedValue(REGIME_1.map((option) => ({...option, read_only: true})));
                renderDetail(buildGraphField({options_omitted: true}), []);

                await waitForLoadingToFinish();
                await openMenu();

                const row = await screen.findByRole('menuitemcheckbox', {name: 'Gamma'});
                expect(row).toHaveAttribute('aria-checked', 'false');

                await userEvent.click(row);

                expect(screen.getByRole('menuitemcheckbox', {name: 'Gamma'})).toHaveAttribute('aria-checked', 'true');
                expect(trigger()).toHaveTextContent('Gamma');
            });

            test('G7: writes option ids, not names, when the picker selection changes', async () => {
                const saveCustomProfileAttribute = jest.fn().mockResolvedValue({data: {}});
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options_omitted: true}), ['opt-1'], {
                    propOverrides: {saveCustomProfileAttribute},
                });

                await waitForLoadingToFinish();
                await openMenu();
                await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'Gamma'}));
                await closeMenu();

                await userEvent.click(screen.getByRole('button', {name: 'Save'}));
                await userEvent.click(await screen.findByRole('button', {name: 'Save Changes'}));

                await waitFor(() => expect(saveCustomProfileAttribute).toHaveBeenCalledWith(
                    user.id,
                    'cpa-1',
                    ['opt-1', 'opt-3'],
                ));
            });

            test('G8: shows resolved names in the change summary for an omitted graph field', async () => {
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options_omitted: true}), ['opt-1', 'opt-2']);

                await waitForLoadingToFinish();
                await openMenu();
                await userEvent.click(await screen.findByRole('menuitemcheckbox', {name: 'Gamma'}));
                await closeMenu();

                await userEvent.click(screen.getByRole('button', {name: 'Save'}));

                const changesList = await screen.findByTestId('changesList');
                expect(changesList).toHaveTextContent('Alpha, Beta, Gamma');
                expect(changesList).not.toHaveTextContent('opt-');
            });

            test('G9: renders today\'s CPAMultiSelect for a graph field when the flag is off', async () => {
                renderDetail(buildGraphField({options: REGIME_1}), ['opt-1'], {flagOn: false});

                await waitForLoadingToFinish();

                expect(within(fieldContainer()).getByRole('combobox')).toBeInTheDocument();
                expect(screen.queryByTestId('cpa-graph-select-cpa-1')).not.toBeInTheDocument();
                expect(mockPageAll).not.toHaveBeenCalled();
            });

            test('G10: keeps an omitted graph field locked when the flag is off', async () => {
                renderDetail(buildGraphField({options_omitted: true}), ['opt-1', 'opt-2'], {flagOn: false});

                await waitForLoadingToFinish();

                expect(fieldContainer().querySelector('input')).toHaveValue('opt-1, opt-2');
                expect(fieldContainer().querySelector('input')).toBeDisabled();
                expect(fieldContainer()).toHaveTextContent(OMITTED_COPY);
                expect(mockPageAll).not.toHaveBeenCalled();
            });

            test('G11: still locks a synced graph field with omitted options', async () => {
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options_omitted: true, ldap: 'dept'}), ['opt-1']);

                await waitForLoadingToFinish();

                expect(trigger()).toBeDisabled();
                expect(screen.getByText('Synced with:')).toBeInTheDocument();
                expect(fieldContainer()).not.toHaveTextContent(OMITTED_COPY);
            });

            test('G12: still locks a protected graph field, including shared_only', async () => {
                mockPageAll.mockResolvedValue([]);
                renderDetail(
                    buildGraphField({protected: true, access_mode: 'shared_only', source_plugin_id: 'plugin.x'}),
                    ['opt-1'],
                );

                await waitForLoadingToFinish();

                expect(trigger()).toBeDisabled();
                expect(fieldContainer()).toHaveTextContent('Managed by plugin');
            });

            test('G13: still locks an owner-managed graph field', async () => {
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(
                    buildGraphField({options_omitted: true, owners: [{id: 'plugin.x', type: 'plugin', scopes: []}]}),
                    ['opt-1'],
                );

                await waitForLoadingToFinish();

                expect(trigger()).toBeDisabled();
                expect(screen.getByText('Synced with:')).toBeInTheDocument();
            });

            test('G14: leaves an admin-managed graph field editable', async () => {
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options_omitted: true, managed: 'admin'}), ['opt-1']);

                await waitForLoadingToFinish();

                expect(trigger()).toBeEnabled();
                await waitFor(() => expect(trigger()).toHaveTextContent('Alpha'));
            });

            test('G15: keeps a multiselect field with omitted options locked', async () => {
                renderDetail(
                    {...buildCPAField({options_omitted: true}), type: 'multiselect'} as UserPropertyField,
                    ['opt-1', 'opt-2'],
                );

                await waitForLoadingToFinish();

                expect(fieldContainer().querySelector('input')).toHaveValue('opt-1, opt-2');
                expect(fieldContainer().querySelector('input')).toBeDisabled();
                expect(fieldContainer()).toHaveTextContent(OMITTED_COPY);
                expect(mockPageAll).not.toHaveBeenCalled();
            });

            test('G16: keeps a select field with omitted options locked', async () => {
                renderDetail(
                    {...buildCPAField({options_omitted: true}), type: 'select'} as UserPropertyField,
                    'opt-1',
                );

                await waitForLoadingToFinish();

                expect(fieldContainer().querySelector('input')).toHaveValue('opt-1');
                expect(fieldContainer().querySelector('input')).toBeDisabled();
                expect(fieldContainer()).toHaveTextContent(OMITTED_COPY);
                expect(mockPageAll).not.toHaveBeenCalled();
            });

            test('G17: opens the menu when the field label is clicked', async () => {
                // The trigger is a <button> inside <label class='cpa-field'>, so
                // label activation opens an overlay where a multiselect in the
                // same wrapper would only take focus. Nothing declares that --
                // it follows from the trigger being the label's first labelable
                // descendant -- so adding htmlFor, reordering the label's
                // children, or moving the indicator out changes it silently.
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options_omitted: true}), ['opt-1']);

                await waitForLoadingToFinish();
                expect(screen.queryByRole('menu')).not.toBeInTheDocument();

                await userEvent.click(fieldContainer());

                expect(await screen.findByRole('menu')).toBeInTheDocument();
            });

            test('G18: names the picker trigger after the field, not the placeholder', async () => {
                // A wrapping <label> forwards clicks to a <button> but does not
                // contribute to its accessible name, so without the explicit
                // ariaLabel every graph trigger on the page announces as
                // "Select values...". Every other test addresses the trigger by
                // test id, which would not notice the prop being dropped.
                mockPageAll.mockResolvedValue(REGIME_1);
                renderDetail(buildGraphField({options_omitted: true}), ['opt-1']);

                await waitForLoadingToFinish();

                expect(screen.getByRole('button', {name: 'department'})).toBe(trigger());
            });

            test('G19: prints ids in the confirm modal for a field whose walk failed', async () => {
                // Pins today's behaviour rather than endorsing it. resolveOptionNames
                // ends in `?? id`, so with no successful walk the change summary
                // lists raw ids. That was accepted while the chips beside it showed
                // the same ids, but Phase 3's 4831b76c3b now renders a failed read as
                // "Value unavailable", so this modal is the only surface still
                // printing one. Asserted as a divergence, and awaiting a decision:
                // when the `?? id` tail changes, this test should fail loudly.
                mockPageAll.mockRejectedValue(new Error('boom'));
                renderDetail(buildGraphField({options_omitted: true}), ['opt-1', 'opt-2']);

                await waitForLoadingToFinish();
                await waitFor(() => expect(mockPageAll).toHaveBeenCalledTimes(1));

                // The chip's remove control lives inside the trigger button and
                // stays available in the error state, which is what makes the
                // modal reachable with nothing resolved.
                const removes = await screen.findAllByRole('button', {name: 'Remove value'});
                expect(removes).toHaveLength(2);
                await userEvent.click(removes[0]);

                // Checked before Save: the confirm modal aria-hides the page
                // behind it, so the chips stop being reachable by role once it
                // is open. The surviving chip is on screen and does not name its
                // id -- the other half of the divergence.
                expect(screen.getAllByRole('button', {name: 'Remove value'})).toHaveLength(1);
                expect(trigger()).not.toHaveTextContent('opt-2');

                await userEvent.click(screen.getByRole('button', {name: 'Save'}));

                const changesList = await screen.findByTestId('changesList');
                expect(changesList).toHaveTextContent('opt-1');
            });
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
