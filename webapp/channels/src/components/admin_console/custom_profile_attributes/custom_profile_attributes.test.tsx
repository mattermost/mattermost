// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {act} from 'react-dom/test-utils';

import type {UserPropertyField, UserPropertyFieldGroupID, UserPropertyFieldType} from '@mattermost/types/properties';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext} from 'tests/react_testing_utils';

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

    beforeEach(() => {
        jest.clearAllMocks();
    });

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

        test('should save LDAP attribute changes', async () => {
            jest.spyOn(Client4, 'patchCustomProfileAttributeField').mockResolvedValue({
                ...attr1,
                attrs: {
                    ...attr1.attrs,
                    ldap: 'new-department',
                },
            });

            renderWithContext(
                <CustomProfileAttributes {...baseProps}/>,
                initialState,
            );

            const input = await screen.findByDisplayValue('department');
            fireEvent.change(input, {target: {value: 'new-department'}});

            const saveAction = baseProps.registerSaveAction.mock.calls[1][0];
            await act(async () => {
                await saveAction();
            });

            expect(Client4.patchCustomProfileAttributeField).toHaveBeenCalledWith('attr1', {
                type: 'text',
                attrs: {
                    ldap: 'new-department',
                    sort_order: 0,
                    value_type: '',
                    visibility: 'when_set',
                },
            });
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

        test('should save SAML attribute changes', async () => {
            jest.spyOn(Client4, 'patchCustomProfileAttributeField').mockResolvedValue({
                ...samlAttr,
                attrs: {
                    ...samlAttr.attrs,
                    saml: 'new-title',
                },
            });

            renderWithContext(
                <CustomProfileAttributes
                    {...baseProps}
                    id='SamlSettings.CustomProfileAttributes'
                />,
                samlInitialState,
            );

            const input = await screen.findByDisplayValue('title');
            fireEvent.change(input, {target: {value: 'new-title'}});

            const saveAction = baseProps.registerSaveAction.mock.calls[1][0];
            await act(async () => {
                await saveAction();
            });

            expect(Client4.patchCustomProfileAttributeField).toHaveBeenCalledWith('attr3', {
                type: 'text',
                attrs: {
                    saml: 'new-title',
                    sort_order: 0,
                    value_type: '',
                    visibility: 'when_set',
                },
            });
        });
    });

    test('should show warning for non-text attributes', async () => {
        const selectAttr = {...attr1, type: 'select' as UserPropertyFieldType};
        const selectInitialState = createInitialState({selectAttr});

        renderWithContext(
            <CustomProfileAttributes {...baseProps}/>,
            selectInitialState,
        );

        const warning = await screen.findByText((content) => content.includes('This attribute will be converted to a TEXT attribute'));
        expect(warning).toBeInTheDocument();
    });

    test('should handle save errors gracefully', async () => {
        jest.spyOn(Client4, 'patchCustomProfileAttributeField').mockRejectedValue(new Error('Network error'));

        renderWithContext(
            <CustomProfileAttributes {...baseProps}/>,
            initialState,
        );

        const input = await screen.findByDisplayValue('department');
        fireEvent.change(input, {target: {value: 'new-department'}});

        const saveAction = baseProps.registerSaveAction.mock.calls[1][0];

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
});
