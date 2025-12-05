// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import KeyboardShortcutsSequence from './keyboard_shortcuts_sequence';

describe('components/shortcuts/KeyboardShortcutsSequence', () => {
    test('should match snapshot when used for modal with description', () => {
        const {container} = renderWithContext(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
            />,
        );

        expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
        expect(container.querySelectorAll('.shortcut-key--tooltip')).toHaveLength(0);
        expect(container.querySelectorAll('.shortcut-key--shortcut-modal')).toHaveLength(2);
    });

    test('should render sequence without description', () => {
        const {container} = renderWithContext(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
                hideDescription={true}
            />,
        );

        // When hideDescription is true, the span with description should not be rendered
        const spanWithDescription = container.querySelector('.shortcut-line span');
        expect(spanWithDescription?.textContent).not.toBe('Keyboard shortcuts');
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with alternative shortcut', () => {
        const {container} = renderWithContext(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘||P\tCtrl|P',
                }}
            />,
        );

        expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
        expect(container.querySelectorAll('.shortcut-key--tooltip')).toHaveLength(0);
        expect(container.querySelectorAll('.shortcut-key--shortcut-modal')).toHaveLength(5);
    });

    test('should render sequence without description', () => {
        const {container} = renderWithContext(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
                isInsideTooltip={true}
            />,
        );

        expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
        expect(container.querySelectorAll('.shortcut-key--tooltip')).toHaveLength(2);
        expect(container.querySelectorAll('.shortcut-key--shortcut-modal')).toHaveLength(0);
    });

    test('should render sequence hoisting description', () => {
        const {container} = renderWithContext(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
                isInsideTooltip={true}
                hoistDescription={true}
            />,
        );

        // When hoistDescription is true, description is rendered outside the span (hoisted)
        // so there should be no span containing the description text
        const spanWithDescription = container.querySelector('.shortcut-line span');
        expect(spanWithDescription?.textContent).not.toBe('Keyboard shortcuts');
        expect(container).toMatchSnapshot();
        expect(container.querySelectorAll('.shortcut-key--tooltip')).toHaveLength(2);
        expect(container.querySelectorAll('.shortcut-key--shortcut-modal')).toHaveLength(0);
    });
});
