// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import type {ComponentProps} from 'react';

import AdvancedTextbox from './advanced_textbox';

// Mock dependencies
jest.mock('components/textbox', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation((props) => (
        <textarea
            data-testid='mock-textbox'
            id={props.id}
            value={props.value}
            onChange={props.onChange}
            onKeyPress={props.onKeyPress}
            placeholder={props.createMessage}
            onFocus={props.onFocus}
            onBlur={props.onBlur}
        />
    )),
}));

jest.mock('components/advanced_text_editor/show_formatting/show_formatting', () => (
    jest.fn().mockImplementation((props) => (
        <button
            data-testid='mock-show-format'
            onClick={props.onClick}
            className={props.active ? 'active' : ''}
        >
            {'Toggle Preview'}
        </button>
    ))
));

describe('AdvancedTextbox', () => {
    const defaultProps: ComponentProps<typeof AdvancedTextbox> = {
        id: 'test-textbox',
        value: 'Initial value',
        channelId: 'channel1',
        onChange: jest.fn(),
        onKeyPress: jest.fn(),
        createMessage: 'Enter text here',
        maxLength: 1000,
        preview: false,
        togglePreview: jest.fn(),
        useChannelMentions: false,
        descriptionMessage: 'This is a description',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders correctly with all props', () => {
        render(<AdvancedTextbox {...defaultProps}/>);

        // Check if textbox is rendered with correct value
        const textbox = screen.getByTestId('mock-textbox');
        expect(textbox).toBeInTheDocument();
        expect(textbox).toHaveValue('Initial value');

        // Check if description is rendered
        expect(screen.getByText('This is a description')).toBeInTheDocument();

        // Check if preview toggle button is rendered
        expect(screen.getByTestId('mock-show-format')).toBeInTheDocument();
    });

    test('calls onChange when text is changed', async () => {
        render(<AdvancedTextbox {...defaultProps}/>);

        const textbox = screen.getByTestId('mock-textbox');
        await userEvent.clear(textbox);
        await userEvent.type(textbox, 'New text');

        expect(defaultProps.onChange).toHaveBeenCalled();
    });

    test('calls onKeyPress when a key is pressed', async () => {
        render(<AdvancedTextbox {...defaultProps}/>);

        const textbox = screen.getByTestId('mock-textbox');
        await userEvent.type(textbox, '{enter}');

        expect(defaultProps.onKeyPress).toHaveBeenCalled();
    });

    test('calls togglePreview when preview button is clicked', async () => {
        render(<AdvancedTextbox {...defaultProps}/>);

        const previewButton = screen.getByTestId('mock-show-format');
        await userEvent.click(previewButton);

        expect(defaultProps.togglePreview).toHaveBeenCalledTimes(1);
    });

    test('renders with preview mode active when specified', () => {
        render(<AdvancedTextbox {...{...defaultProps, preview: true}}/>);

        const previewButton = screen.getByTestId('mock-show-format');
        expect(previewButton).toHaveClass('active');
    });

    test('renders without description when not provided', () => {
        render(<AdvancedTextbox {...{...defaultProps, descriptionMessage: undefined}}/>);

        expect(screen.queryByTestId('mm-modal-generic-section-item__description')).not.toBeInTheDocument();
    });

    test('handles JSX element as descriptionMessage', () => {
        const jsxDescription = <span data-testid='jsx-description'>{'JSX Description'}</span>;
        render(<AdvancedTextbox {...{...defaultProps, descriptionMessage: jsxDescription}}/>);

        expect(screen.getByTestId('jsx-description')).toBeInTheDocument();
        expect(screen.getByText('JSX Description')).toBeInTheDocument();
    });

    test('displays character count when showCharacterCount is true and there is error', () => {
        const props = {
            ...defaultProps,
            maxLength: 10,
            value: 'Short text',
            showCharacterCount: true,
        };
        const {rerender} = render(<AdvancedTextbox {...props}/>);

        rerender(<AdvancedTextbox {...{...props, value: 'This text is too long and exceeds the limit'}}/>);

        expect(screen.getByText('43/10')).toBeInTheDocument();
    });

    test('shows error when text exceeds character limit', async () => {
        const props = {
            ...defaultProps,
            maxLength: 10,
            value: 'Short text',
            showCharacterCount: true,
        };

        const {rerender} = render(<AdvancedTextbox {...props}/>);

        // Initially under the limit
        expect(screen.queryByText(/exceeds the maximum character limit/)).not.toBeInTheDocument();

        // Update with text that exceeds the limit
        rerender(<AdvancedTextbox {...{...props, value: 'This text is too long and exceeds the limit'}}/>);

        // Should show error message
        expect(screen.getByText(/exceeds the maximum character limit/)).toBeInTheDocument();
        expect(screen.getByText('This text is too long and exceeds the limit'.length + '/' + props.maxLength)).toBeInTheDocument();
    });

    test('shows error when text is below minimum character limit', async () => {
        const props = {
            ...defaultProps,
            maxLength: 100,
            minLength: 10,
            value: '',
            showCharacterCount: true,
        };

        const {rerender} = render(<AdvancedTextbox {...props}/>);

        // Empty text should not trigger min length error
        expect(screen.queryByText(/must be at least/)).not.toBeInTheDocument();

        // Update with text that is below the minimum limit
        rerender(<AdvancedTextbox {...{...props, value: 'Too short'}}/>);

        // Should show error message
        expect(screen.getByText(/must be at least 10 characters/)).toBeInTheDocument();
        expect(screen.getByText('9/10')).toBeInTheDocument();
    });

    test('allows custom error message for minimum length', async () => {
        const props = {
            ...defaultProps,
            maxLength: 100,
            minLength: 10,
            minLengthErrorMessage: 'Custom minimum length error',
            value: 'Short',
            showCharacterCount: true,
        };

        render(<AdvancedTextbox {...props}/>);

        // Should show custom error message
        expect(screen.getByText('Custom minimum length error')).toBeInTheDocument();
    });

    test('clears minimum length error when text meets requirements', async () => {
        const props = {
            ...defaultProps,
            maxLength: 100,
            minLength: 5,
            value: 'abc',
            showCharacterCount: true,
        };

        const {rerender} = render(<AdvancedTextbox {...props}/>);

        // Initially below the minimum
        expect(screen.getByText(/must be at least 5 characters/)).toBeInTheDocument();

        // Update with text that meets the minimum
        rerender(<AdvancedTextbox {...{...props, value: 'abcdef'}}/>);

        // Error should be cleared
        expect(screen.queryByText(/must be at least 5 characters/)).not.toBeInTheDocument();
    });

    test('does not render preview toggle button when readOnly is true', () => {
        render(<AdvancedTextbox {...{...defaultProps, readOnly: true}}/>);

        // Preview toggle button should not be in the document
        expect(screen.queryByTestId('mock-show-format')).not.toBeInTheDocument();
    });

    test('forces preview mode when readOnly is true regardless of preview prop', () => {
        // Get reference to the mocked Textbox component
        const TextboxMock = require('components/textbox').default;

        // Clear previous calls to the mock
        TextboxMock.mockClear();

        // Render with readOnly true and preview false
        render(<AdvancedTextbox {...{...defaultProps, readOnly: true, preview: false}}/>);

        // Verify Textbox was called with preview=true
        expect(TextboxMock).toHaveBeenCalledWith(
            expect.objectContaining({
                preview: true,
            }),
            expect.anything(),
        );
    });

    // Tests for the floating label functionality
    test('does not render label when name prop is not provided', () => {
        render(<AdvancedTextbox {...defaultProps}/>);

        // Label should not be in the document
        expect(document.querySelector('.AdvancedTextbox__label')).not.toBeInTheDocument();
    });

    test('renders label when name prop is provided', () => {
        render(<AdvancedTextbox {...{...defaultProps, name: 'Test Label'}}/>);

        // Label should be in the document
        const label = document.querySelector('.AdvancedTextbox__label');
        expect(label).toBeInTheDocument();
        expect(label).toHaveTextContent('Test Label');
    });

    test('applies active class to label when component has value', () => {
        render(<AdvancedTextbox {...{...defaultProps, name: 'Test Label', value: 'Some value'}}/>);

        // Label should have active class
        const label = document.querySelector('.AdvancedTextbox__label');
        expect(label).toHaveClass('AdvancedTextbox__label--active');
    });

    test('applies active class to label when component is focused', () => {
        render(<AdvancedTextbox {...{...defaultProps, name: 'Test Label', value: ''}}/>);

        // Initially label should not have active class
        let label = document.querySelector('.AdvancedTextbox__label');
        expect(label).not.toHaveClass('AdvancedTextbox__label--active');

        // Focus the textbox
        const textbox = screen.getByTestId('mock-textbox');
        fireEvent.focus(textbox);

        // Label should now have active class
        label = document.querySelector('.AdvancedTextbox__label');
        expect(label).toHaveClass('AdvancedTextbox__label--active');
    });

    test('removes active class from label when component loses focus and has no value', () => {
        render(<AdvancedTextbox {...{...defaultProps, name: 'Test Label', value: ''}}/>);

        // Focus the textbox
        const textbox = screen.getByTestId('mock-textbox');
        fireEvent.focus(textbox);

        // Label should have active class
        let label = document.querySelector('.AdvancedTextbox__label');
        expect(label).toHaveClass('AdvancedTextbox__label--active');

        // Blur the textbox
        fireEvent.blur(textbox);

        // Label should not have active class
        label = document.querySelector('.AdvancedTextbox__label');
        expect(label).not.toHaveClass('AdvancedTextbox__label--active');
    });

    test('keeps active class on label when component loses focus but has value', () => {
        render(<AdvancedTextbox {...{...defaultProps, name: 'Test Label', value: 'Some value'}}/>);

        // Focus the textbox
        const textbox = screen.getByTestId('mock-textbox');
        fireEvent.focus(textbox);

        // Label should have active class
        let label = document.querySelector('.AdvancedTextbox__label');
        expect(label).toHaveClass('AdvancedTextbox__label--active');

        // Blur the textbox
        fireEvent.blur(textbox);

        // Label should still have active class because there's a value
        label = document.querySelector('.AdvancedTextbox__label');
        expect(label).toHaveClass('AdvancedTextbox__label--active');
    });
});
