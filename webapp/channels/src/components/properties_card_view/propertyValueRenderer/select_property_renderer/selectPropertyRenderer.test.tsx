// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue, SelectPropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import SelectPropertyRenderer from './selectPropertyRenderer';

describe('SelectPropertyRenderer', () => {
    const baseField = {
        id: 'test-field',
        name: 'Test Field',
        type: 'select',
        attrs: {
            editable: true,
            options: [
                {id: 'option1', name: 'option1', color: 'light_blue'},
                {id: 'option2', name: 'option2', color: 'dark_blue'},
                {id: 'option3', name: 'option3', color: 'dark_red'},
                {id: 'option4', name: 'option4', color: 'light_gray'},
            ],
        },
    } as SelectPropertyField;

    it('should render select property with light_blue color', () => {
        const field = baseField;
        const value = {value: 'option1'} as PropertyValue<string>;

        renderWithContext(
            <SelectPropertyRenderer
                field={field}
                value={value}
            />,
        );

        const element = screen.getByTestId('select-property');
        expect(element).toBeInTheDocument();
        expect(element).toHaveTextContent('option1');
        expect(element).toHaveStyle({
            backgroundColor: 'rgba(var(--button-bg-rgb), 0.08)',
            color: '#FFF',
        });
    });

    it('should render select property with dark_blue color', () => {
        const field = baseField;
        const value = {value: 'option2'} as PropertyValue<string>;

        renderWithContext(
            <SelectPropertyRenderer
                field={field}
                value={value}
            />,
        );

        const element = screen.getByTestId('select-property');
        expect(element).toHaveTextContent('option2');
        expect(element).toHaveStyle({
            backgroundColor: 'rgba(var(--sidebar-text-active-border-rgb), 0.92)',
            color: '#FFF',
        });
    });

    it('should render select property with dark_red color', () => {
        const field = baseField;
        const value = {value: 'option3'} as PropertyValue<string>;

        renderWithContext(
            <SelectPropertyRenderer
                field={field}
                value={value}
            />,
        );

        const element = screen.getByTestId('select-property');
        expect(element).toHaveTextContent('option3');
        expect(element).toHaveStyle({
            backgroundColor: 'var(--error-text)',
            color: '#FFF',
        });
    });

    it('should render select property with default light_gray color', () => {
        const field = baseField;
        const value = {value: 'option4'} as PropertyValue<string>;

        renderWithContext(
            <SelectPropertyRenderer
                field={field}
                value={value}
            />,
        );

        const element = screen.getByTestId('select-property');
        expect(element).toHaveTextContent('option4');
        expect(element).toHaveStyle({
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
            color: 'rgba(var(--center-channel-color-rgb), 1)',
        });
    });

    it('should use default color when option color is not found', () => {
        const field: SelectPropertyField = {
            ...baseField,
            attrs: {
                editable: false,
                options: [
                    {id: 'option1', name: 'option1', color: 'unknown_color'},
                ],
            },
        };
        const value = {value: 'option1'} as PropertyValue<string>;

        renderWithContext(
            <SelectPropertyRenderer
                field={field}
                value={value}
            />,
        );

        const element = screen.getByTestId('select-property');
        expect(element).toHaveStyle({
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
            color: 'rgba(var(--center-channel-color-rgb), 1)',
        });
    });

    it('should use default color when option is not found in field options', () => {
        const field = baseField;
        const value = {value: 'nonexistent_option'} as PropertyValue<string>;

        renderWithContext(
            <SelectPropertyRenderer
                field={field}
                value={value}
            />,
        );

        const element = screen.getByTestId('select-property');
        expect(element).toHaveTextContent('nonexistent_option');
        expect(element).toHaveStyle({
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
            color: 'rgba(var(--center-channel-color-rgb), 1)',
        });
    });

    it('should use default color when field has no options', () => {
        const field: SelectPropertyField = {
            ...baseField,
            attrs: {
                editable: false,
                options: [],
            },
        };
        const value = {value: 'some_value'} as PropertyValue<string>;

        renderWithContext(
            <SelectPropertyRenderer
                field={field}
                value={value}
            />,
        );

        const element = screen.getByTestId('select-property');
        expect(element).toHaveTextContent('some_value');
        expect(element).toHaveStyle({
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
            color: 'rgba(var(--center-channel-color-rgb), 1)',
        });
    });

    it('should use default color when field attrs is undefined', () => {
        const field = {
            id: 'test-field',
            name: 'Test Field',
            type: 'select',
        } as PropertyField;
        const value = {value: 'some_value'} as PropertyValue<string>;

        renderWithContext(
            <SelectPropertyRenderer
                field={field}
                value={value}
            />,
        );

        const element = screen.getByTestId('select-property');
        expect(element).toHaveTextContent('some_value');
        expect(element).toHaveStyle({
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
            color: 'rgba(var(--center-channel-color-rgb), 1)',
        });
    });
});
