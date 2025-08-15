// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {PropertyValue} from '@mattermost/types/properties';

import {renderWithContext} from 'tests/react_testing_utils';

import TextPropertyRenderer from './textPropertyRenderer';

describe('TextPropertyRenderer', () => {
    const baseProps = {
        value: {
            value: 'Test text value',
        } as PropertyValue<string>,
    };

    test('should render text property value', () => {
        renderWithContext(<TextPropertyRenderer {...baseProps}/>);

        const textElement = screen.getByTestId('text-property');
        expect(textElement).toBeVisible();
        expect(textElement).toHaveTextContent('Test text value');
        expect(textElement).toHaveClass('TextProperty');
    });

    test('should render empty string value', () => {
        const props = {
            value: {
                value: '',
            } as PropertyValue<string>,
        };

        renderWithContext(<TextPropertyRenderer {...props}/>);

        const textElement = screen.getByTestId('text-property');
        expect(textElement).toBeVisible();
        expect(textElement).toHaveTextContent('');
        expect(textElement).toHaveClass('TextProperty');
    });

    test('should render numeric value as string', () => {
        const props = {
            value: {
                value: 123,
            } as PropertyValue<number>,
        };

        renderWithContext(<TextPropertyRenderer {...props}/>);

        const textElement = screen.getByTestId('text-property');
        expect(textElement).toBeVisible();
        expect(textElement).toHaveTextContent('123');
        expect(textElement).toHaveClass('TextProperty');
    });

    test('should render null value', () => {
        const props = {
            value: {
                value: null,
            } as PropertyValue<null>,
        };

        renderWithContext(<TextPropertyRenderer {...props}/>);

        const textElement = screen.getByTestId('text-property');
        expect(textElement).toBeVisible();
        expect(textElement).toHaveTextContent('');
        expect(textElement).toHaveClass('TextProperty');
    });

    test('should render undefined value', () => {
        const props = {
            value: {
                value: undefined,
            } as PropertyValue<undefined>,
        };

        renderWithContext(<TextPropertyRenderer {...props}/>);

        const textElement = screen.getByTestId('text-property');
        expect(textElement).toBeVisible();
        expect(textElement).toHaveTextContent('');
        expect(textElement).toHaveClass('TextProperty');
    });

    test('should render special characters', () => {
        const props = {
            value: {
                value: '!@#$%^&*()_+-=[]{}|;:,.<>?',
            } as PropertyValue<string>,
        };

        renderWithContext(<TextPropertyRenderer {...props}/>);

        const textElement = screen.getByTestId('text-property');
        expect(textElement).toBeVisible();
        expect(textElement).toHaveTextContent('!@#$%^&*()_+-=[]{}|;:,.<>?');
        expect(textElement).toHaveClass('TextProperty');
    });
});
