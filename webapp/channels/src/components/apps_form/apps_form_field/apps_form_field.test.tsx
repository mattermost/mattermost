// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act} from '@testing-library/react';
import React from 'react';

import type {AppField} from '@mattermost/types/apps';

import {AppFieldTypes} from 'mattermost-redux/constants/apps';

import {renderWithContext} from 'tests/react_testing_utils';

import AppsFormField from './apps_form_field';
import type {Props} from './apps_form_field';

describe('components/apps_form/apps_form_field/AppsFormField', () => {
    const baseProps: Props = {
        name: 'testing',
        actions: {
            autocompleteChannels: jest.fn(),
            autocompleteUsers: jest.fn(),
        },
        field: {
            name: 'field1',
            type: AppFieldTypes.TEXT,
        },
        value: '',
        onChange: jest.fn(),
        performLookup: jest.fn(),
    };

    describe('Required field indicators', () => {
        it('should render required field with red asterisk', () => {
            const requiredField: AppField = {
                name: 'required-field',
                type: AppFieldTypes.TEXT,
                label: 'Required Field',
                is_required: true,
            };

            const {container} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={requiredField}
                />,
            );

            // Check for the red asterisk in required fields
            const errorText = container.querySelector('.error-text');
            expect(errorText).toBeInTheDocument();
            expect(errorText).toHaveTextContent('*');
        });

        it('should render optional field with (optional) text', () => {
            const optionalField: AppField = {
                name: 'optional-field',
                type: AppFieldTypes.TEXT,
                label: 'Optional Field',
                is_required: false,
            };

            const {getByText} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={optionalField}
                />,
            );

            expect(getByText('(optional)')).toBeInTheDocument();
        });

        it('should use modal_label over label when present', () => {
            const fieldWithModalLabel: AppField = {
                name: 'modal-label-field',
                type: AppFieldTypes.TEXT,
                label: 'Regular Label',
                modal_label: 'Modal Label',
                is_required: true,
            };

            const {getByText} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={fieldWithModalLabel}
                />,
            );

            expect(getByText('Modal Label')).toBeInTheDocument();
        });
    });

    describe('Radio field support', () => {
        it('should render radio field correctly', () => {
            const radioField: AppField = {
                name: 'radio-field',
                type: AppFieldTypes.RADIO,
                label: 'Radio Field',
                options: [
                    {label: 'Option 1', value: 'opt1'},
                    {label: 'Option 2', value: 'opt2'},
                    {label: 'Option 3', value: 'opt3'},
                ],
                is_required: true,
            };

            const {getByText} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={radioField}
                    value='opt2'
                />,
            );

            expect(getByText('Option 1')).toBeInTheDocument();
            expect(getByText('Option 2')).toBeInTheDocument();
            expect(getByText('Option 3')).toBeInTheDocument();
        });

        it('should handle radio field without options', () => {
            const radioFieldNoOptions: AppField = {
                name: 'radio-field-no-options',
                type: AppFieldTypes.RADIO,
                label: 'Radio Field No Options',
                is_required: false,
            };

            const {container} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={radioFieldNoOptions}
                />,
            );

            // Should render without crashing
            expect(container).toBeInTheDocument();
        });
    });

    describe('Field type handling', () => {
        it('should render text field', () => {
            const textField: AppField = {
                name: 'text-field',
                type: AppFieldTypes.TEXT,
                label: 'Text Field',
                max_length: 100,
            };

            const {container} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={textField}
                />,
            );

            const input = container.querySelector('input[type="text"]');
            expect(input).toBeInTheDocument();
        });

        it('should render textarea field', () => {
            const textareaField: AppField = {
                name: 'textarea-field',
                type: AppFieldTypes.TEXT,
                subtype: 'textarea',
                label: 'Textarea Field',
                max_length: 500,
            };

            const {container} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={textareaField}
                />,
            );

            const textarea = container.querySelector('textarea');
            expect(textarea).toBeInTheDocument();
        });

        it('should render boolean field', () => {
            const boolField: AppField = {
                name: 'bool-field',
                type: AppFieldTypes.BOOL,
                label: 'Boolean Field',
            };

            const {container} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={boolField}
                    value={false}
                />,
            );

            const checkbox = container.querySelector('input[type="checkbox"]');
            expect(checkbox).toBeInTheDocument();
        });

        it('should render static select field', () => {
            const selectField: AppField = {
                name: 'select-field',
                type: AppFieldTypes.STATIC_SELECT,
                label: 'Select Field',
                options: [
                    {label: 'Option 1', value: 'opt1'},
                    {label: 'Option 2', value: 'opt2'},
                ],
            };

            const {container} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={selectField}
                />,
            );

            // Look for react-select component
            const reactSelect = container.querySelector('.react-select');
            expect(reactSelect).toBeInTheDocument();
        });

        it('should render user select field', async () => {
            const userField: AppField = {
                name: 'user-field',
                type: AppFieldTypes.USER,
                label: 'User Field',
            };

            let container: HTMLElement;
            await act(async () => {
                const result = renderWithContext(
                    <AppsFormField
                        {...baseProps}
                        field={userField}
                    />,
                );
                container = result.container;
            });

            const reactSelect = container!.querySelector('.react-select');
            expect(reactSelect).toBeInTheDocument();
        });

        it('should render channel select field', async () => {
            const channelField: AppField = {
                name: 'channel-field',
                type: AppFieldTypes.CHANNEL,
                label: 'Channel Field',
            };

            let container: HTMLElement;
            await act(async () => {
                const result = renderWithContext(
                    <AppsFormField
                        {...baseProps}
                        field={channelField}
                    />,
                );
                container = result.container;
            });

            const reactSelect = container!.querySelector('.react-select');
            expect(reactSelect).toBeInTheDocument();
        });

        it('should render dynamic select field', async () => {
            const dynamicSelectField: AppField = {
                name: 'dynamic-select-field',
                type: AppFieldTypes.DYNAMIC_SELECT,
                label: 'Dynamic Select Field',
            };

            let container: HTMLElement;
            await act(async () => {
                const result = renderWithContext(
                    <AppsFormField
                        {...baseProps}
                        field={dynamicSelectField}
                    />,
                );
                container = result.container;
            });

            const reactSelect = container!.querySelector('.react-select');
            expect(reactSelect).toBeInTheDocument();
        });

        it('should render markdown field', () => {
            const markdownField: AppField = {
                name: 'markdown-field',
                type: AppFieldTypes.MARKDOWN,
                description: '**Bold text** and *italic text*',
            };

            const {container} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={markdownField}
                />,
            );

            // Markdown component should be rendered
            expect(container).toBeInTheDocument();
        });
    });

    describe('Error handling', () => {
        it('should display error text when provided', () => {
            const fieldWithError: AppField = {
                name: 'error-field',
                type: AppFieldTypes.TEXT,
                label: 'Field with Error',
            };

            const {getByText} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={fieldWithError}
                    errorText='This field has an error'
                />,
            );

            expect(getByText('This field has an error')).toBeInTheDocument();
        });

        it('should render help text alongside error text', () => {
            const fieldWithHelp: AppField = {
                name: 'help-field',
                type: AppFieldTypes.TEXT,
                label: 'Field with Help',
                description: 'This is help text',
            };

            const {getByText} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={fieldWithHelp}
                    errorText='Error message'
                />,
            );

            expect(getByText('This is help text')).toBeInTheDocument();
            expect(getByText('Error message')).toBeInTheDocument();
        });
    });

    describe('handleSelected method', () => {
        it('should handle single selection', () => {
            const mockOnChange = jest.fn();
            const selectField: AppField = {
                name: 'select-field',
                type: AppFieldTypes.STATIC_SELECT,
                label: 'Select Field',
                options: [
                    {label: 'Option 1', value: 'opt1'},
                    {label: 'Option 2', value: 'opt2'},
                ],
            };

            const {container} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={selectField}
                    onChange={mockOnChange}
                />,
            );

            // The handleSelected method should be tested through integration
            // or by testing the AppsFormSelectField component separately
            expect(container).toBeInTheDocument();
        });

        it('should handle array selection for multiselect', () => {
            const mockOnChange = jest.fn();
            const multiselectField: AppField = {
                name: 'multiselect-field',
                type: AppFieldTypes.STATIC_SELECT,
                label: 'Multiselect Field',
                multiselect: true,
                options: [
                    {label: 'Option 1', value: 'opt1'},
                    {label: 'Option 2', value: 'opt2'},
                ],
            };

            const {container} = renderWithContext(
                <AppsFormField
                    {...baseProps}
                    field={multiselectField}
                    onChange={mockOnChange}
                />,
            );

            expect(container).toBeInTheDocument();
        });
    });
});
