// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import AutosizeTextarea from './autosize_textarea';

describe('components/AutosizeTextarea', () => {
    test('renders textarea with default id', () => {
        render(<AutosizeTextarea/>);

        const textarea = screen.getByTestId('autosize_textarea');
        expect(textarea).toBeInTheDocument();
        expect(textarea.tagName).toBe('TEXTAREA');
    });

    test('renders textarea with custom id and placeholder', () => {
        const testId = 'custom_textarea';
        const placeholder = 'Type something...';

        render(
            <AutosizeTextarea
                id={testId}
                placeholder={placeholder}
            />,
        );

        const textarea = screen.getByTestId(testId);
        const placeholderElement = screen.getByTestId(`${testId}_placeholder`);

        expect(textarea).toBeInTheDocument();
        expect(placeholderElement).toBeInTheDocument();
        expect(placeholderElement).toHaveTextContent(placeholder);
    });

    test('handles value changes and callbacks', async () => {
        const onChange = jest.fn();
        const onHeightChange = jest.fn();
        const onInput = jest.fn();

        render(
            <AutosizeTextarea
                onChange={onChange}
                onHeightChange={onHeightChange}
                onInput={onInput}
            />,
        );

        const textarea = screen.getByTestId('autosize_textarea');
        await userEvent.type(textarea, 'test message');

        expect(onChange).toHaveBeenCalled();
        expect(onInput).toHaveBeenCalled();
    });

    test('handles disabled state', () => {
        render(<AutosizeTextarea disabled={true}/>);

        const textarea = screen.getByTestId('autosize_textarea');
        expect(textarea).toBeDisabled();
    });

    test('handles default value with newline', () => {
        const defaultValue = 'test\n';
        render(<AutosizeTextarea defaultValue={defaultValue}/>);

        const textarea = screen.getByTestId('autosize_textarea');
        expect(textarea).toHaveValue(defaultValue);
    });

    test('placeholder disappears when value is present', () => {
        const testId = 'custom_textarea';
        const placeholder = 'Type something...';

        const {rerender} = render(
            <AutosizeTextarea
                id={testId}
                placeholder={placeholder}
            />,
        );

        expect(screen.getByTestId(`${testId}_placeholder`)).toBeInTheDocument();

        rerender(
            <AutosizeTextarea
                id={testId}
                placeholder={placeholder}
                value='some text'
            />,
        );

        expect(screen.queryByTestId(`${testId}_placeholder`)).not.toBeInTheDocument();
    });
});
