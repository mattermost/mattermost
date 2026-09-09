// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {Suspense} from 'react';

import type {CELEditorProps} from 'components/admin_console/access_control/editors/cel_editor/editor';
import type {TableEditorProps} from 'components/admin_console/access_control/editors/table_editor/table_editor';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import {AccessControlCELEditor, AccessControlTableEditor} from './access_control_editors';

jest.mock('monaco-editor', () => ({
    editor: {
        create: jest.fn(() => ({
            setValue: jest.fn(),
            getValue: jest.fn(() => ''),
            getModel: jest.fn(() => ({
                onDidChangeContent: jest.fn(() => ({dispose: jest.fn()})),
            })),
            onDidChangeCursorPosition: jest.fn(() => ({dispose: jest.fn()})),
            updateOptions: jest.fn(),
            dispose: jest.fn(),
        })),
        addKeybindingRule: jest.fn(),
    },
    KeyMod: {CtrlCmd: 2048},
    KeyCode: {KeyF: 36},
}));

jest.mock('components/admin_console/access_control/editors/cel_editor/language_provider', () => ({
    MonacoLanguageProvider: () => null,
}));

// Compile-time check that the exports stay lazy (React.lazy) components.
const lazyExports: [
    React.LazyExoticComponent<React.ComponentType<TableEditorProps>>,
    React.LazyExoticComponent<React.ComponentType<CELEditorProps>>,
] = [AccessControlTableEditor, AccessControlCELEditor];

describe('plugins/access_control_editors', () => {
    test('exports are React.lazy components', () => {
        for (const exported of lazyExports) {
            expect((exported as unknown as {$$typeof: symbol}).$$typeof).toBe(Symbol.for('react.lazy'));
        }
    });

    test('AccessControlTableEditor lazily resolves and renders', async () => {
        renderWithContext(
            <Suspense fallback='loading'>
                <AccessControlTableEditor
                    value=''
                    onChange={jest.fn()}
                    userAttributes={[]}
                    enableUserManagedAttributes={false}
                    onParseError={jest.fn()}
                    actions={{getVisualAST: jest.fn()}}
                />
            </Suspense>,
            {},
        );

        // Generous timeout: first render transpiles/resolves the whole editor chunk.
        expect(await screen.findByText('Select a user attribute and values to create a rule', {}, {timeout: 10000})).toBeInTheDocument();
    });

    test('AccessControlCELEditor lazily resolves and renders', async () => {
        renderWithContext(
            <Suspense fallback='loading'>
                <AccessControlCELEditor
                    value=''
                    onChange={jest.fn()}
                    userAttributes={[]}
                />
            </Suspense>,
            {},
        );

        // The placeholder text also appears in the help text, so query by the editor's aria-label.
        expect(await screen.findByLabelText('CEL Expression Editor', {}, {timeout: 10000})).toHaveTextContent('user.attributes.<attribute> == <value>');
    });
});
