// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import CELEditor, {buildCELSchemas} from './editor';

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

jest.mock('./language_provider', () => ({
    MonacoLanguageProvider: () => null,
}));

jest.mock('mattermost-redux/actions/access_control', () => ({
    searchUsersForExpression: jest.fn(),
}));

describe('CELEditor', () => {
    const expression = 'user.attributes.department == "Engineering"';

    const baseProps = {
        value: expression,
        onChange: jest.fn(),
        userAttributes: [
            {attribute: 'department', values: ['Engineering']},
        ],
    };

    let checkExpressionSpy: jest.SpyInstance;

    beforeEach(() => {
        checkExpressionSpy = jest.spyOn(Client4, 'checkAccessControlExpression').mockResolvedValue([]);
        (searchUsersForExpression as jest.Mock).mockImplementation(() => () => Promise.resolve({data: {users: [], total: 0}}));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('should use injected checkExpression and skip Client4', async () => {
        const checkExpression = jest.fn().mockResolvedValue([]);

        renderWithContext(
            <CELEditor
                {...baseProps}
                actions={{checkExpression}}
            />,
            {},
        );

        await waitFor(() => {
            expect(checkExpression).toHaveBeenCalledWith(expression);
        });
        expect(checkExpressionSpy).not.toHaveBeenCalled();
        expect(await screen.findByText('Valid')).toBeInTheDocument();
    });

    test('should fall back to Client4 when checkExpression is not injected', async () => {
        renderWithContext(
            <CELEditor
                {...baseProps}
                channelId='channel1'
                teamId='team1'
            />,
            {},
        );

        await waitFor(() => {
            expect(checkExpressionSpy).toHaveBeenCalledWith(expression, 'channel1', 'team1');
        });
        expect(await screen.findByText('Valid')).toBeInTheDocument();
    });

    test('should surface validation errors from injected checkExpression', async () => {
        const onValidate = jest.fn();
        const checkExpression = jest.fn().mockResolvedValue([
            {message: 'undeclared reference', line: 1, column: 0},
        ]);

        renderWithContext(
            <CELEditor
                {...baseProps}
                onValidate={onValidate}
                actions={{checkExpression}}
            />,
            {},
        );

        expect(await screen.findByText('undeclared reference @L1:1')).toBeInTheDocument();
        expect(onValidate).toHaveBeenCalledWith(false);
    });

    test('should use injected searchUsers for the test modal and skip the redux thunk', async () => {
        const checkExpression = jest.fn().mockResolvedValue([]);
        const mockSearch = jest.fn().mockResolvedValue({data: {users: [], total: 0}});

        renderWithContext(
            <CELEditor
                {...baseProps}
                actions={{checkExpression, searchUsers: mockSearch}}
            />,
            {},
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /test access rule/i})).not.toBeDisabled();
        });

        await userEvent.click(screen.getByRole('button', {name: /test access rule/i}));

        await waitFor(() => {
            expect(mockSearch).toHaveBeenCalledWith(expression, '', '', 50, undefined);
        });
        expect(searchUsersForExpression).not.toHaveBeenCalled();
    });

    test('should fall back to the redux thunk for the test modal when searchUsers is not injected', async () => {
        renderWithContext(
            <CELEditor
                {...baseProps}
                channelId='channel1'
                teamId='team1'
            />,
            {},
        );

        await waitFor(() => {
            expect(screen.getByRole('button', {name: /test access rule/i})).not.toBeDisabled();
        });

        await userEvent.click(screen.getByRole('button', {name: /test access rule/i}));

        await waitFor(() => {
            expect(searchUsersForExpression).toHaveBeenCalledWith(expression, '', '', 50, 'channel1', 'team1');
        });
        expect(screen.getByText('Access Rule Test Results')).toBeInTheDocument();
    });

    describe('test button overrides', () => {
        const PARENT_TOOLTIP = 'Testing is unavailable here.';
        const MASKED_TOOLTIP = 'Test is unavailable because this policy contains restricted attribute values.';

        const testButton = () => screen.getByRole('button', {name: /test access rule/i});

        const hoverTooltip = async () => {
            await userEvent.hover(testButton(), {pointerEventsCheck: 0});
            return screen.findByRole('tooltip', {}, {timeout: 2000});
        };

        test('enables the button for a valid expression when the overrides are omitted', async () => {
            renderWithContext(<CELEditor {...baseProps}/>, {});

            await waitFor(() => expect(testButton()).toBeEnabled());
        });

        test('enables the button when testButtonDisabled is false', async () => {
            renderWithContext(
                <CELEditor
                    {...baseProps}
                    testButtonDisabled={false}
                    testButtonTooltip={PARENT_TOOLTIP}
                />,
                {},
            );

            await waitFor(() => expect(testButton()).toBeEnabled());
        });

        test('disables a valid expression\'s button and shows the parent tooltip when testButtonDisabled is set', async () => {
            renderWithContext(
                <CELEditor
                    {...baseProps}
                    testButtonDisabled={true}
                    testButtonTooltip={PARENT_TOOLTIP}
                />,
                {},
            );

            expect(await screen.findByText('Valid')).toBeInTheDocument();
            expect(testButton()).toBeDisabled();
            expect(await hoverTooltip()).toHaveTextContent(PARENT_TOOLTIP);
        });

        test('does not forward clicks to onTestClick while testButtonDisabled is set', async () => {
            const onTestClick = jest.fn();
            renderWithContext(
                <CELEditor
                    {...baseProps}
                    onTestClick={onTestClick}
                    testButtonDisabled={true}
                />,
                {},
            );

            expect(await screen.findByText('Valid')).toBeInTheDocument();
            await userEvent.click(testButton(), {pointerEventsCheck: 0});
            expect(onTestClick).not.toHaveBeenCalled();
        });

        test('prefers the parent tooltip over the masked-values tooltip when testButtonDisabled is set', async () => {
            renderWithContext(
                <CELEditor
                    {...baseProps}
                    hasMaskedRows={true}
                    testButtonDisabled={true}
                    testButtonTooltip={PARENT_TOOLTIP}
                />,
                {},
            );

            expect(await hoverTooltip()).toHaveTextContent(PARENT_TOOLTIP);
        });

        test('prefers the parent tooltip over the masked-values tooltip even when testButtonDisabled is not set', async () => {
            renderWithContext(
                <CELEditor
                    {...baseProps}
                    hasMaskedRows={true}
                    testButtonTooltip={PARENT_TOOLTIP}
                />,
                {},
            );

            expect(testButton()).toBeDisabled();
            expect(await hoverTooltip()).toHaveTextContent(PARENT_TOOLTIP);
        });

        test('shows the masked-values tooltip by default', async () => {
            renderWithContext(
                <CELEditor
                    {...baseProps}
                    hasMaskedRows={true}
                />,
                {},
            );

            expect(testButton()).toBeDisabled();
            expect(await hoverTooltip()).toHaveTextContent(MASKED_TOOLTIP);
        });
    });
});

describe('buildCELSchemas', () => {
    test('treats attributes without an object type as user attributes', () => {
        const schemas = buildCELSchemas([
            {attribute: 'department', values: []},
            {attribute: 'email', values: [], isNative: true},
        ]);

        expect(schemas.user).toEqual(['attributes', 'email']);
        expect(schemas['user.attributes']).toEqual(['department']);
    });

    test('offers only user.attributes when no session attributes are present', () => {
        const schemas = buildCELSchemas([
            {attribute: 'department', values: [], objectType: 'user'},
            {attribute: 'location', values: [], objectType: 'user'},
        ]);

        expect(schemas.user).toEqual(['attributes']);
        expect(schemas['user.attributes']).toEqual(['department', 'location']);
        expect(schemas['user.session']).toBeUndefined();
    });

    test('adds the user.session bucket when a session attribute is present', () => {
        const schemas = buildCELSchemas([
            {attribute: 'department', values: [], objectType: 'user'},
            {attribute: 'ip_address', values: [], objectType: 'session'},
        ]);

        expect(schemas.user).toEqual(['attributes', 'session']);
        expect(schemas['user.attributes']).toEqual(['department']);
        expect(schemas['user.session']).toEqual(['ip_address']);
    });

    test('drops names with spaces or that are empty', () => {
        const schemas = buildCELSchemas([
            {attribute: 'has space', values: [], objectType: 'user'},
            {attribute: '   ', values: [], objectType: 'user'},
            {attribute: 'valid', values: [], objectType: 'user'},
            {attribute: 'session valid', values: [], objectType: 'session'},
            {attribute: 'ip_address', values: [], objectType: 'session'},
        ]);

        expect(schemas['user.attributes']).toEqual(['valid']);
        expect(schemas['user.session']).toEqual(['ip_address']);
    });

    test('skips null or undefined attribute names without throwing', () => {
        const schemas = buildCELSchemas([
            {attribute: null, values: [], objectType: 'user'},
            {attribute: undefined, values: [], isNative: true},
            {attribute: 'department', values: [], objectType: 'user'},
        ]);

        expect(schemas.user).toEqual(['attributes']);
        expect(schemas['user.attributes']).toEqual(['department']);
    });
});
