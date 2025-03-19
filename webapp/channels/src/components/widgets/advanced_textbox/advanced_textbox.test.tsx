// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
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
        onKeypress: jest.fn(),
        createMessage: 'Enter text here',
        characterLimit: 1000,
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

    test('calls onKeypress when a key is pressed', async () => {
        render(<AdvancedTextbox {...defaultProps}/>);

        const textbox = screen.getByTestId('mock-textbox');
        await userEvent.type(textbox, '{enter}');

        expect(defaultProps.onKeypress).toHaveBeenCalled();
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
            characterLimit: 10,
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
            characterLimit: 10,
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
        expect(screen.getByText('This text is too long and exceeds the limit'.length + '/' + props.characterLimit)).toBeInTheDocument();
    });
});
