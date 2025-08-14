// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PropertyField, PropertyValue, SelectPropertyField} from '@mattermost/types/properties';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import SelectPropertyRenderer from './selectPropertyRenderer';

describe('SelectPropertyRenderer', () => {
    const baseField: SelectPropertyField = {
        id: 'test-field',
        name: 'Test Field',
        type: 'select',
        attrs: {
            options: [
                {name: 'option1', color: 'light_blue'},
                {name: 'option2', color: 'dark_blue'},
                {name: 'option3', color: 'dark_red'},
                {name: 'option4', color: 'light_gray'},
            ],
        },
    };

    const baseValue: PropertyValue<string> = {
        value: 'option1',
    };

    it('should render select property with light_blue color', () => {
        const field = baseField;
        const value = {value: 'option1'};

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
        const value = {value: 'option2'};

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
        const value = {value: 'option3'};

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
        const value = {value: 'option4'};

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
            color: '#3F4350',
        });
    });

    it('should use default color when option color is not found', () => {
        const field: SelectPropertyField = {
            ...baseField,
            attrs: {
                options: [
                    {name: 'option1', color: 'unknown_color'},
                ],
            },
        };
        const value = {value: 'option1'};

        renderWithContext(
            <SelectPropertyRenderer
                field={field}
                value={value}
            />,
        );

        const element = screen.getByTestId('select-property');
        expect(element).toHaveStyle({
            backgroundColor: 'rgba(var(--center-channel-color-rgb), 0.12)',
            color: '#3F4350',
        });
    });

    it('should use default color when option is not found in field options', () => {
        const field = baseField;
        const value = {value: 'nonexistent_option'};

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
            color: '#3F4350',
        });
    });

    it('should use default color when field has no options', () => {
        const field: SelectPropertyField = {
            ...baseField,
            attrs: {
                options: [],
            },
        };
        const value = {value: 'some_value'};

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
            color: '#3F4350',
        });
    });

    it('should use default color when field attrs is undefined', () => {
        const field: PropertyField = {
            id: 'test-field',
            name: 'Test Field',
            type: 'select',
        };
        const value = {value: 'some_value'};

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
            color: '#3F4350',
        });
    });
});
