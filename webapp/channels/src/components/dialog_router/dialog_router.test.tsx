// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DialogElement} from '@mattermost/types/integrations';

import {renderWithContext} from 'tests/react_testing_utils';
import EmojiMap from 'utils/emoji_map';

import DialogRouter from './dialog_router';

// Mock the selector
const mockInteractiveDialogAppsFormEnabled = jest.fn();
jest.mock('mattermost-redux/selectors/entities/interactive_dialog', () => ({
    interactiveDialogAppsFormEnabled: (...args: any[]) => mockInteractiveDialogAppsFormEnabled(...args),
}));

// Mock the components
jest.mock('components/interactive_dialog/interactive_dialog', () => {
    return function MockInteractiveDialog(props: any) {
        return (
            <div data-testid='interactive-dialog'>
                <div data-testid='legacy-title'>{props.title}</div>
                <div data-testid='legacy-url'>{props.url}</div>
                <div data-testid='legacy-callback-id'>{props.callbackId}</div>
            </div>
        );
    };
});

jest.mock('./interactive_dialog_adapter', () => {
    return function MockInteractiveDialogAdapter(props: any) {
        return (
            <div data-testid='interactive-dialog-adapter'>
                <div data-testid='adapter-title'>{props.title}</div>
                <div data-testid='adapter-url'>{props.url}</div>
                <div data-testid='adapter-callback-id'>{props.callbackId}</div>
            </div>
        );
    };
});

describe('components/dialog_router/DialogRouter', () => {
    const baseProps = {
        url: 'http://example.com',
        callbackId: 'abc123',
        title: 'Test Dialog',
        introductionText: 'Test introduction',
        iconUrl: 'http://example.com/icon.png',
        submitLabel: 'Submit',
        state: 'test-state',
        notifyOnCancel: true,
        elements: [],
        emojiMap: new EmojiMap(new Map()),
        onExited: jest.fn(),
        actions: {
            submitInteractiveDialog: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Component Selection Logic', () => {
        test('should render InteractiveDialogAdapter when apps form is enabled and URL is present', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            const {getByTestId} = renderWithContext(
                <DialogRouter {...baseProps}/>,
            );

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
            expect(getByTestId('adapter-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('adapter-url')).toHaveTextContent('http://example.com');
            expect(getByTestId('adapter-callback-id')).toHaveTextContent('abc123');
        });

        test('should render InteractiveDialog when apps form is disabled', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(false);

            const {getByTestId} = renderWithContext(
                <DialogRouter {...baseProps}/>,
            );

            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
            expect(getByTestId('legacy-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('legacy-url')).toHaveTextContent('http://example.com');
            expect(getByTestId('legacy-callback-id')).toHaveTextContent('abc123');
        });

        test('should render InteractiveDialog when URL is missing', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            const propsWithoutUrl = {
                ...baseProps,
                url: '',
            };

            const {getByTestId} = renderWithContext(
                <DialogRouter {...propsWithoutUrl}/>,
            );

            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
            expect(getByTestId('legacy-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('legacy-url')).toHaveTextContent('');
        });

        test('should render InteractiveDialog when URL is undefined', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            const propsWithUndefinedUrl = {
                ...baseProps,
                url: undefined as any,
            };

            const {getByTestId} = renderWithContext(
                <DialogRouter {...propsWithUndefinedUrl}/>,
            );

            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
        });

        test('should render InteractiveDialog when both apps form is disabled and URL is missing', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(false);

            const propsWithoutUrl = {
                ...baseProps,
                url: '',
            };

            const {getByTestId} = renderWithContext(
                <DialogRouter {...propsWithoutUrl}/>,
            );

            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
        });
    });

    describe('Props Passing', () => {
        test('should handle onExited callback properly', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            const onExited = jest.fn();
            const propsWithCallback = {
                ...baseProps,
                onExited,
            };

            const {getByTestId} = renderWithContext(
                <DialogRouter {...propsWithCallback}/>,
            );

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
            expect(getByTestId('adapter-title')).toHaveTextContent('Test Dialog');
        });

        test('should render with extended props', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            const extendedProps = {
                ...baseProps,
                conversionOptions: {
                    validateInputs: true,
                    sanitizeStrings: false,
                },
                elements: [
                    {
                        name: 'test-field',
                        type: 'text',
                        display_name: 'Test Field',
                        subtype: '',
                        default: '',
                        placeholder: '',
                        help_text: '',
                        optional: false,
                        min_length: 0,
                        max_length: 0,
                        data_source: '',
                        options: [],
                    } as DialogElement,
                ],
            };

            const {getByTestId} = renderWithContext(
                <DialogRouter {...extendedProps}/>,
            );

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
        });

        test('should render legacy dialog with extended props', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(false);

            const extendedProps = {
                ...baseProps,
                elements: [
                    {
                        name: 'test-field',
                        type: 'text',
                        display_name: 'Test Field',
                        subtype: '',
                        default: '',
                        placeholder: '',
                        help_text: '',
                        optional: false,
                        min_length: 0,
                        max_length: 0,
                        data_source: '',
                        options: [],
                    } as DialogElement,
                ],
            };

            const {getByTestId} = renderWithContext(
                <DialogRouter {...extendedProps}/>,
            );

            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
        });
    });

    describe('useMemo Optimization', () => {
        test('should memoize component selection based on feature flag and URL', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            // First render
            const {rerender, getByTestId} = renderWithContext(
                <DialogRouter {...baseProps}/>,
            );

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();

            // Clear mock calls
            jest.clearAllMocks();

            // Re-render with same props - should use memoized component
            rerender(<DialogRouter {...baseProps}/>);

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
        });

        test('should recalculate component when feature flag changes', () => {
            // Start with enabled
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            const {rerender, getByTestId} = renderWithContext(
                <DialogRouter {...baseProps}/>,
            );

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();

            // Change feature flag to disabled
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(false);

            rerender(<DialogRouter {...baseProps}/>);

            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
        });

        test('should recalculate component when URL changes', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            const {rerender, getByTestId} = renderWithContext(
                <DialogRouter {...baseProps}/>,
            );

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();

            // Change URL to empty
            const propsWithoutUrl = {
                ...baseProps,
                url: '',
            };

            rerender(<DialogRouter {...propsWithoutUrl}/>);

            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        test('should handle missing feature flag state gracefully', () => {
            // Mock selector to return undefined/falsy
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(undefined);

            const {getByTestId} = renderWithContext(
                <DialogRouter {...baseProps}/>,
            );

            // Should default to legacy dialog when feature flag state is missing
            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
        });

        test('should handle whitespace-only URL as truthy', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            const propsWithWhitespaceUrl = {
                ...baseProps,
                url: '   ',
            };

            const {getByTestId} = renderWithContext(
                <DialogRouter {...propsWithWhitespaceUrl}/>,
            );

            // Whitespace URL should still be truthy, so adapter should be used
            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
        });

        test('should handle null URL', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            const propsWithNullUrl = {
                ...baseProps,
                url: null as any,
            };

            const {getByTestId} = renderWithContext(
                <DialogRouter {...propsWithNullUrl}/>,
            );

            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
        });

        test('should call selector with state', () => {
            mockInteractiveDialogAppsFormEnabled.mockReturnValue(true);

            renderWithContext(
                <DialogRouter {...baseProps}/>,
            );

            expect(mockInteractiveDialogAppsFormEnabled).toHaveBeenCalled();
        });
    });
});
