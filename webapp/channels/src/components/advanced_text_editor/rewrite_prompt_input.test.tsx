// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import RewritePromptInput from './rewrite_prompt_input';

describe('RewritePromptInput', () => {
    const baseProps = {
        value: '',
        placeholder: 'Ask AI to edit message...',
        onChange: jest.fn(),
        onKeyDown: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders an input with the given placeholder', () => {
        renderWithContext(<RewritePromptInput {...baseProps}/>);
        expect(screen.getByPlaceholderText('Ask AI to edit message...')).toBeInTheDocument();
    });

    test('forwards the input DOM node through the ref', () => {
        const ref = React.createRef<HTMLInputElement>();
        renderWithContext(
            <RewritePromptInput
                {...baseProps}
                ref={ref}
            />,
        );
        expect(ref.current).toBe(screen.getByPlaceholderText('Ask AI to edit message...'));
    });

    test('notifies onChange as the user types', () => {
        const onChange = jest.fn();
        renderWithContext(
            <RewritePromptInput
                {...baseProps}
                onChange={onChange}
            />,
        );
        const input = screen.getByPlaceholderText('Ask AI to edit message...');
        fireEvent.change(input, {target: {value: 'shorten this'}});
        expect(onChange).toHaveBeenCalled();
    });

    test('preserves in-progress IME composition when an unrelated re-render lands mid-composition', () => {
        // Regression test for MM-70289: a fully controlled input re-asserts its value on every
        // render, wiping the text an IME is still composing. Simulate the browser composing a
        // Korean syllable while the parent re-renders with an unchanged (still empty) value.
        const {rerender} = renderWithContext(<RewritePromptInput {...baseProps}/>);
        const input = screen.getByPlaceholderText('Ask AI to edit message...') as HTMLInputElement;

        fireEvent.compositionStart(input);
        fireEvent.input(input, {target: {value: '그'}});

        // An unrelated re-render (value prop still lagging at its pre-composition value).
        rerender(<RewritePromptInput {...baseProps}/>);

        expect(input.value).toBe('그');
    });

    test('syncs an externally changed value into the input (e.g. clearing after submit)', () => {
        const {rerender} = renderWithContext(
            <RewritePromptInput
                {...baseProps}
                value='draft prompt'
            />,
        );
        const input = screen.getByPlaceholderText('Ask AI to edit message...') as HTMLInputElement;
        expect(input.value).toBe('draft prompt');

        rerender(
            <RewritePromptInput
                {...baseProps}
                value=''
            />,
        );
        expect(input.value).toBe('');
    });
});
