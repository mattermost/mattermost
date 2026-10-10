// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField, UserPropertyFieldGroupID, UserPropertyFieldType} from '@mattermost/types/properties_user';

import {Client4} from 'mattermost-redux/client';

import {act, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import CustomProfileAttributes from './custom_profile_attributes';

jest.mock('mattermost-redux/client');

describe('components/admin_console/custom_profile_attributes/CustomProfileAttributes', () => {
    const baseProps = {
        isDisabled: false,
        setSaveNeeded: jest.fn(),
        registerSaveAction: jest.fn(),
        unRegisterSaveAction: jest.fn(),
    };

    const baseField: Omit<UserPropertyField, 'id' | 'name' | 'attrs'> = {
        type: 'text',
        group_id: 'custom_profile_attributes' as UserPropertyFieldGroupID,
        create_at: 1736541716295,
        delete_at: 0,
        update_at: 0,
        created_by: '',
        updated_by: '',
        target_id: '',
        target_type: '',
        object_type: '',
    };

    const createAttribute = (id: string, name: string, attrs: Record<string, string>): UserPropertyField => ({
        ...baseField,
        id,
        name,
        attrs: {
            ...attrs,
            sort_order: 0,
            visibility: 'when_set',
            value_type: '',
        },
    });

    const attr1 = createAttribute('attr1', 'Department', {ldap: 'department'});
    const attr2 = createAttribute('attr2', 'Location', {ldap: 'location'});
    const samlAttr = createAttribute('attr3', 'Title', {saml: 'title'});

    const createInitialState = (attributes: Record<string, UserPropertyField>) => ({
        entities: {
            general: {
                customProfileAttributes: attributes,
            },
        },
    });

    const initialState = createInitialState({attr1, attr2});

    test('should not render anything when no attributes exist', () => {
        const {container} = renderWithContext(
            <CustomProfileAttributes {...baseProps}/>,
        );

        expect(container.firstChild).toBeNull();
    });

    describe('LDAP attributes', () => {
        test('should render LDAP attributes with correct help text', async () => {
            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                initialState,
            );

            await screen.findByText('Department');
            await screen.findByText('Location');

            expect(screen.getByDisplayValue('department')).toBeInTheDocument();
            expect(screen.getByDisplayValue('location')).toBeInTheDocument();

            const helpText = screen.getAllByText((content) => content.includes('When set, users cannot edit their'));
            expect(helpText).toHaveLength(2);
        });

        test('should point the subtitle at Attribute Management', async () => {
            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                initialState,
            );

            expect(await screen.findByRole('link', {name: 'Attribute Management'})).toHaveAttribute('href', '/admin_console/system_attributes/manage_attributes');
        });

        test('should save LDAP attribute changes by patching only the link', async () => {
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as any);

            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                initialState,
            );

            const input = await screen.findByDisplayValue('department');
            await userEvent.clear(input);
            await userEvent.type(input, 'new-department');

            const calls = baseProps.registerSaveAction.mock.calls;
            const saveAction = calls[calls.length - 1][0];
            await act(async () => {
                await saveAction();
            });

            expect(Client4.patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'attr1', {attrs: {ldap: 'new-department'}});
            expect(Client4.patchCustomProfileAttributeField).not.toHaveBeenCalled();
        });
    });

    describe('SAML attributes', () => {
        const samlInitialState = createInitialState({samlAttr});
        test('should render SAML attributes with correct help text', async () => {
            (Client4.getCustomProfileAttributeFields as jest.Mock).mockImplementation(async () => {
                return [samlAttr];
            });
            renderWithContext(
                <CustomProfileAttributes
                    {...baseProps}
                    id='SamlSettings.CustomProfileAttributes'
                />,
                samlInitialState,
            );

            await screen.findByText('Title');
            expect(screen.getByDisplayValue('title')).toBeInTheDocument();

            const helpText = screen.getByText((content) => content.includes('The attribute in the SAML Assertion'));
            expect(helpText).toBeInTheDocument();
        });

        test('should save SAML attribute changes by patching only the link', async () => {
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as any);

            renderWithContext(
                <CustomProfileAttributes
                    {...baseProps}
                    id='SamlSettings.CustomProfileAttributes'
                />,
                samlInitialState,
            );

            const input = await screen.findByDisplayValue('title');
            await userEvent.clear(input);
            await userEvent.type(input, 'new-title');

            const calls = baseProps.registerSaveAction.mock.calls;
            const saveAction = calls[calls.length - 1][0];
            await act(async () => {
                await saveAction();
            });

            expect(Client4.patchPropertyField).toHaveBeenCalledWith('access_control', 'user', 'attr3', {attrs: {saml: 'new-title'}});
            expect(Client4.patchCustomProfileAttributeField).not.toHaveBeenCalled();
        });
    });

    test.each(['select', 'multiselect'])('should not warn about a %s attribute, which syncs as it is', async (type) => {
        const syncableAttr = {...attr1, type: type as UserPropertyFieldType};

        renderWithContext(
            <CustomProfileAttributes {...baseProps}/>,
            createInitialState({syncableAttr}),
        );

        await screen.findByDisplayValue('department');
        expect(screen.queryByText((content) => content.includes('This attribute will be converted to a TEXT attribute'))).not.toBeInTheDocument();
    });

    test('should warn about, and convert to text on save, an attribute whose type cannot be synced', async () => {
        jest.spyOn(Client4, 'patchCustomProfileAttributeField').mockResolvedValue({} as any);
        const dateAttr = {...attr1, type: 'date' as unknown as UserPropertyFieldType};

        renderWithContext(
            <CustomProfileAttributes {...baseProps}/>,
            createInitialState({dateAttr}),
        );

        const warning = await screen.findByText((content) => content.includes('This attribute will be converted to a TEXT attribute'));
        expect(warning).toBeInTheDocument();

        const input = screen.getByDisplayValue('department');
        await userEvent.clear(input);
        await userEvent.type(input, 'hireDate');

        const saveAction = baseProps.registerSaveAction.mock.calls.at(-1)[0];
        await act(async () => {
            await saveAction();
        });

        expect(Client4.patchCustomProfileAttributeField).toHaveBeenCalledWith('attr1', {
            type: 'text',
            attrs: {
                ldap: 'hireDate',
                sort_order: 0,
                value_type: '',
                visibility: 'when_set',
            },
        });
        expect(Client4.patchPropertyField).not.toHaveBeenCalled();
    });

    test('should handle save errors gracefully', async () => {
        jest.spyOn(Client4, 'patchPropertyField').mockRejectedValue(new Error('Network error'));

        renderWithContext(
            <CustomProfileAttributes {...baseProps}/>,
            initialState,
        );

        const input = await screen.findByDisplayValue('department');
        await userEvent.clear(input);
        await userEvent.type(input, 'new-department');

        const calls = baseProps.registerSaveAction.mock.calls;
        const saveAction = calls[calls.length - 1][0];

        // Verify the save action catches and returns the error
        await expect(saveAction()).resolves.toEqual(
            expect.objectContaining({
                error: expect.any(Error),
            }),
        );
    });

    test('should respect disabled state', async () => {
        renderWithContext(
            <CustomProfileAttributes
                {...baseProps}
                isDisabled={true}
            />,
            initialState,
        );

        const input = await screen.findByDisplayValue('department');
        expect(input).toBeDisabled();
    });

    test('should handle empty attribute values', async () => {
        const emptyAttr = createAttribute('attr1', 'Department', {ldap: ''});
        const emptyInitialState = createInitialState({emptyAttr});

        renderWithContext(
            <CustomProfileAttributes {...baseProps}/>,
            emptyInitialState,
        );

        const input = await screen.findByDisplayValue('');
        expect(input).toBeInTheDocument();
    });

    test('should cleanup on unmount', async () => {
        const {unmount} = renderWithContext(
            <CustomProfileAttributes {...baseProps}/>,
            initialState,
        );

        await screen.findByDisplayValue('department');

        // Verify save action was registered
        expect(baseProps.registerSaveAction).toHaveBeenCalledTimes(1);
        const saveAction = baseProps.registerSaveAction.mock.calls[0][0];

        unmount();

        // Verify same save action was unregistered
        expect(baseProps.unRegisterSaveAction).toHaveBeenCalledWith(saveAction);
    });

    test('should handle invalid attribute types', async () => {
        const invalidAttr = {...attr1, type: 'invalid_type' as any};
        const invalidInitialState = createInitialState({invalidAttr});

        renderWithContext(
            <CustomProfileAttributes {...baseProps}/>,
            invalidInitialState,
        );

        const warning = await screen.findByText((content) => content.includes('This attribute will be converted to a TEXT attribute'));
        expect(warning).toBeInTheDocument();
    });

    describe('linked fields (Global Attribute template)', () => {
        beforeEach(() => {
            jest.clearAllMocks();
        });

        const linkedAttr: UserPropertyField = {
            ...baseField,
            id: 'linked-user-field-id',
            name: 'job_title',
            linked_field_id: 'template-field-id',
            attrs: {
                sort_order: 0,
                visibility: 'when_set',
                value_type: '',
                ldap: 'title',
            },
        };

        test('should patch template and user field via property API, not legacy CPA endpoint', async () => {
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as any);

            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                createInitialState({linkedAttr}),
            );

            const input = await screen.findByDisplayValue('title');
            await userEvent.clear(input);
            await userEvent.type(input, 'new-title');

            const saveAction = baseProps.registerSaveAction.mock.calls.at(-1)[0];
            await act(async () => {
                await saveAction();
            });

            expect(Client4.patchPropertyField).toHaveBeenCalledWith(
                'access_control', 'template', 'template-field-id', {attrs: {ldap: 'new-title'}},
            );
            expect(Client4.patchPropertyField).toHaveBeenCalledWith(
                'access_control', 'user', 'linked-user-field-id', {attrs: {ldap: 'new-title'}},
            );
            expect(Client4.patchCustomProfileAttributeField).not.toHaveBeenCalled();
        });

        test('should disable input and explain why for a linked field whose type cannot be synced', async () => {
            const linkedRankAttr: UserPropertyField = {
                ...linkedAttr,
                type: 'rank' as unknown as UserPropertyFieldType,
            };

            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                createInitialState({linkedAttr: linkedRankAttr}),
            );

            const input = await screen.findByDisplayValue('title');
            expect(input).toBeDisabled();
            expect(await screen.findByText(/management attribute of type rank/i)).toBeInTheDocument();
            expect(screen.getByText(/Only text, select and multiselect attributes support sync/)).toBeInTheDocument();
        });

        test('should keep a linked select field editable', async () => {
            const linkedSelectAttr: UserPropertyField = {
                ...linkedAttr,
                type: 'select' as UserPropertyFieldType,
            };

            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                createInitialState({linkedAttr: linkedSelectAttr}),
            );

            const input = await screen.findByDisplayValue('title');
            expect(input).not.toBeDisabled();
            expect(screen.queryByText(/management attribute of type/i)).not.toBeInTheDocument();
        });

        test('should send null when the attribute value is cleared', async () => {
            jest.spyOn(Client4, 'patchPropertyField').mockResolvedValue({} as any);

            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                createInitialState({linkedAttr}),
            );

            const input = await screen.findByDisplayValue('title');
            await userEvent.clear(input);

            const saveAction = baseProps.registerSaveAction.mock.calls.at(-1)[0];
            await act(async () => {
                await saveAction();
            });

            expect(Client4.patchPropertyField).toHaveBeenCalledWith(
                'access_control', 'template', 'template-field-id', {attrs: {ldap: null}},
            );
            expect(Client4.patchPropertyField).toHaveBeenCalledWith(
                'access_control', 'user', 'linked-user-field-id', {attrs: {ldap: null}},
            );
        });
    });

    describe('display_name labels', () => {
        test('should render TextSetting label and help text using display_name', async () => {
            const displayNameAttr: UserPropertyField = {
                ...baseField,
                id: 'attr_display',
                name: 'my_field',
                attrs: {
                    sort_order: 0,
                    visibility: 'when_set',
                    value_type: '',
                    ldap: 'department',
                    display_name: 'My Display Name',
                },
            };
            const state = createInitialState({displayNameAttr});

            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                state,
            );

            const labelEl = await screen.findByTestId('custom_profile_attribute-my_fieldlabel');
            expect(labelEl.tagName).toBe('LABEL');
            expect(labelEl).toHaveTextContent('My Display Name');
            expect(labelEl).not.toHaveTextContent('my_field');

            const helpTextEl = screen.getByTestId('custom_profile_attribute-my_fieldhelp-text');
            expect(helpTextEl).toHaveTextContent(/users cannot edit their My Display Name/);
            expect(helpTextEl).not.toHaveTextContent('users cannot edit their my_field');
        });

        test('should fall back to name when display_name is missing', async () => {
            const fallbackAttr: UserPropertyField = {
                ...baseField,
                id: 'attr_fallback',
                name: 'my_field',
                attrs: {
                    sort_order: 0,
                    visibility: 'when_set',
                    value_type: '',
                    ldap: 'department',
                },
            };
            const state = createInitialState({fallbackAttr});

            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                state,
            );

            const labelEl = await screen.findByTestId('custom_profile_attribute-my_fieldlabel');
            expect(labelEl.tagName).toBe('LABEL');
            expect(labelEl).toHaveTextContent('my_field');

            const helpTextEl = screen.getByTestId('custom_profile_attribute-my_fieldhelp-text');
            expect(helpTextEl).toHaveTextContent(/users cannot edit their my_field/);
        });
    });
});
