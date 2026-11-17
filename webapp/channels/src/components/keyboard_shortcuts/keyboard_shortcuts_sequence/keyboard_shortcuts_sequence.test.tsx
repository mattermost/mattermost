// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import KeyboardShortcutsSequence from './keyboard_shortcuts_sequence';

describe('components/shortcuts/KeyboardShortcutsSequence', () => {
    test('should render when used for modal with description', () => {
        const {container} = renderWithContext(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
            />,
        );

        expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
        expect(container.querySelectorAll('.shortcut-key--tooltip')).toHaveLength(0);
        expect(container.querySelectorAll('.shortcut-key--shortcut-modal')).toHaveLength(2);
    });

    test('should render sequence without description', () => {
        renderWithContext(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘|/',
                }}
                hideDescription={true}
            />,
        );

        expect(screen.queryByText('Keyboard shortcuts')).not.toBeInTheDocument();
    });

    test('should render with alternative shortcut', () => {
        const {container} = renderWithContext(
            <KeyboardShortcutsSequence
                shortcut={{
                    id: 'test',
                    defaultMessage: 'Keyboard shortcuts\t⌘||P\tCtrl|P',
                }}
            />,
        );

        expect(screen.getByText('Keyboard shortcuts')).toBeInTheDocument();
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

        // When hoistDescription is true, the description text is rendered outside the shortcut-line div
        // (hoisted up), but it is still present in the document
        expect(screen.queryByText('Keyboard shortcuts')).toBeInTheDocument();
        expect(container.querySelector('.shortcut-line span')).toBeNull();
        expect(container.querySelectorAll('.shortcut-key--tooltip')).toHaveLength(2);
        expect(container.querySelectorAll('.shortcut-key--shortcut-modal')).toHaveLength(0);
    });
});
