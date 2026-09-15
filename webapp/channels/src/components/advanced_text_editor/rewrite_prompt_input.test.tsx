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

    test('forwards the input DOM node through both object and function refs', () => {
        const objectRef = React.createRef<HTMLInputElement>();
        let functionRefNode: HTMLInputElement | null = null;
        const {unmount} = renderWithContext(
            <RewritePromptInput
                {...baseProps}
                ref={objectRef}
            />,
        );
        const input = screen.getByPlaceholderText('Ask AI to edit message...');
        expect(objectRef.current).toBe(input);
        unmount();

        renderWithContext(
            <RewritePromptInput
                {...baseProps}
                ref={(node) => {
                    functionRefNode = node;
                }}
            />,
        );
        expect(functionRefNode).toBe(screen.getByPlaceholderText('Ask AI to edit message...'));
    });

    test('forwards the typed value to onChange', () => {
        const onChange = jest.fn();
        renderWithContext(
            <RewritePromptInput
                {...baseProps}
                onChange={onChange}
            />,
        );
        const input = screen.getByPlaceholderText('Ask AI to edit message...');
        fireEvent.change(input, {target: {value: 'shorten this'}});
        expect(onChange.mock.calls[0][0].target.value).toBe('shorten this');
    });

    test('forwards key presses to onKeyDown (used to submit the prompt on Enter)', () => {
        const onKeyDown = jest.fn();
        renderWithContext(
            <RewritePromptInput
                {...baseProps}
                onKeyDown={onKeyDown}
            />,
        );
        const input = screen.getByPlaceholderText('Ask AI to edit message...');
        fireEvent.keyDown(input, {key: 'Enter'});
        expect(onKeyDown.mock.calls[0][0].key).toBe('Enter');
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

    test('does not clobber composing text when the parent value changes mid-composition', () => {
        const {rerender} = renderWithContext(<RewritePromptInput {...baseProps}/>);
        const input = screen.getByPlaceholderText('Ask AI to edit message...') as HTMLInputElement;

        fireEvent.compositionStart(input);
        fireEvent.input(input, {target: {value: '그'}});
        rerender(
            <RewritePromptInput
                {...baseProps}
                value='stale parent value'
            />,
        );

        expect(input.value).toBe('그');
    });

    test('does not clobber typed text when the input re-renders from focus (legend/label)', () => {
        renderWithContext(<RewritePromptInput {...baseProps}/>);
        const input = screen.getByPlaceholderText('Ask AI to edit message...') as HTMLInputElement;

        fireEvent.focus(input);
        fireEvent.input(input, {target: {value: '한글'}});

        expect(input.value).toBe('한글');
    });

    test('does not clobber the input once the value prop catches up to what was typed', () => {
        // The normal flow: the user types, onChange updates the parent, and the next render
        // arrives with a value that already matches the DOM. The imperative sync must be a no-op.
        const {rerender} = renderWithContext(<RewritePromptInput {...baseProps}/>);
        const input = screen.getByPlaceholderText('Ask AI to edit message...') as HTMLInputElement;

        fireEvent.input(input, {target: {value: '글'}});
        rerender(
            <RewritePromptInput
                {...baseProps}
                value='글'
            />,
        );

        expect(input.value).toBe('글');
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
