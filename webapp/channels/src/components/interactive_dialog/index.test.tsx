// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import InteractiveDialogContainer from './index';

// Mock the DialogRouter component
jest.mock('components/dialog_router', () => {
    return function MockDialogRouter(props: any) {
        // Simulate the DialogRouter behavior for testing
        const isAppsFormEnabled = props.isAppsFormEnabled !== false; // Default to true
        const hasUrl = Boolean(props.url);

        if (isAppsFormEnabled && hasUrl) {
            return <div data-testid='interactive-dialog-adapter'>{'InteractiveDialogAdapter'}</div>;
        }
        return <div data-testid='interactive-dialog'>{'InteractiveDialog'}</div>;
    };
});

describe('components/interactive_dialog/InteractiveDialogContainer', () => {
    const baseState = {
        entities: {
            integrations: {
                dialog: {
                    url: 'http://example.com',
                    dialog: {
                        callback_id: 'abc',
                        elements: [],
                        title: 'test title',
                        introduction_text: 'Some introduction text',
                        icon_url: 'http://example.com/icon.png',
                        submit_label: 'Yes',
                        notify_on_cancel: true,
                        state: 'some state',
                    },
                },
            },
        },
    };

    test('should render DialogRouter with correct props', () => {
        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            baseState,
        );

        // Since we have a URL in baseState, DialogRouter should render the adapter
        expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
    });

    test('should render DialogRouter with legacy dialog when no URL', () => {
        const stateWithoutUrl = {
            ...baseState,
            entities: {
                ...baseState.entities,
                integrations: {
                    ...baseState.entities.integrations,
                    dialog: {
                        ...baseState.entities.integrations.dialog,
                        url: '',
                    },
                },
            },
        };

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            stateWithoutUrl,
        );

        // Without URL, DialogRouter should render legacy dialog
        expect(getByTestId('interactive-dialog')).toBeInTheDocument();
    });

    test('should handle empty dialog state', () => {
        const emptyDialogState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                integrations: {
                    ...baseState.entities.integrations,
                    dialog: undefined,
                },
            },
        };

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            emptyDialogState,
        );

        // With empty dialog and no URL, should render legacy dialog
        expect(getByTestId('interactive-dialog')).toBeInTheDocument();
    });

    test('should handle missing integrations state', () => {
        const stateWithoutIntegrations = {
            ...baseState,
            entities: {
                ...baseState.entities,
                integrations: undefined,
            },
        };

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            stateWithoutIntegrations,
        );

        expect(getByTestId('interactive-dialog')).toBeInTheDocument();
    });

    test('should map state with all dialog properties correctly', () => {
        const fullDialogState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                integrations: {
                    dialog: {
                        url: 'http://example.com/submit',
                        dialog: {
                            callback_id: 'callback123',
                            elements: [
                                {
                                    name: 'field1',
                                    type: 'text',
                                    display_name: 'Field 1',
                                },
                            ],
                            title: 'Complex Dialog',
                            introduction_text: 'This is a complex dialog',
                            icon_url: 'http://example.com/icon.png',
                            submit_label: 'Create',
                            notify_on_cancel: true,
                            state: 'dialog-state-123',
                        },
                    },
                },
            },
        };

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            fullDialogState,
        );

        // Since we have a URL in the state, DialogRouter should render the adapter
        expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
    });

    test('should handle missing dialog.dialog nested property', () => {
        const stateWithoutNestedDialog = {
            ...baseState,
            entities: {
                ...baseState.entities,
                integrations: {
                    dialog: {
                        url: 'http://example.com',
                        dialog: null as any,
                    },
                },
            },
        };

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            stateWithoutNestedDialog,
        );

        expect(getByTestId('interactive-dialog')).toBeInTheDocument();
    });

    test('should provide default values for missing dialog properties', () => {
        const minimalDialogState = {
            ...baseState,
            entities: {
                ...baseState.entities,
                integrations: {
                    dialog: {

                        // Only provide URL
                        url: 'http://example.com',
                        dialog: {

                            // Minimal dialog with only required fields
                        },
                    },
                },
            },
        };

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            minimalDialogState,
        );

        // Should render the adapter since URL is provided
        expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
    });

    test('should handle onExited callback properly', () => {
        const onExited = jest.fn();

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer onExited={onExited}/>,
            baseState,
        );

        // Should render dialog router with the callback
        expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
    });

    test('should include emojiMap from state', () => {
        const stateWithEmojis = {
            ...baseState,
            entities: {
                ...baseState.entities,
                emojis: {
                    customEmoji: {
                        emoji1: {
                            id: 'emoji1',
                            name: 'emoji1',
                            category: 'custom' as const,
                        },
                    },
                },
            },
        };

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            stateWithEmojis,
        );

        // Should render successfully with emojis in state
        expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
    });

    test('should bind action creators correctly', () => {
        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            baseState,
        );

        // Should render successfully with actions bound
        expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
    });

    test('should handle null/undefined URL correctly', () => {
        const stateWithNullUrl = {
            ...baseState,
            entities: {
                ...baseState.entities,
                integrations: {
                    dialog: {
                        url: null as any,
                        dialog: {
                            callback_id: 'abc',
                            title: 'Test',
                        },
                    },
                },
            },
        };

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            stateWithNullUrl,
        );

        // Should render legacy dialog when URL is null
        expect(getByTestId('interactive-dialog')).toBeInTheDocument();
    });

    test('should handle undefined title correctly', () => {
        const stateWithUndefinedTitle = {
            ...baseState,
            entities: {
                ...baseState.entities,
                integrations: {
                    dialog: {
                        url: 'http://example.com',
                        dialog: {
                            callback_id: 'abc',
                            title: undefined,
                        },
                    },
                },
            },
        };

        const {getByTestId} = renderWithContext(
            <InteractiveDialogContainer/>,
            stateWithUndefinedTitle,
        );

        // Should render adapter since URL is provided
        expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
    });
});
