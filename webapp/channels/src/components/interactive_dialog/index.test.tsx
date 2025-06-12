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
            general: {
                config: {},
                license: {},
            },
            channels: {
                channels: {},
                roles: {},
            },
            teams: {
                teams: {},
            },
            posts: {
                posts: {},
            },
            users: {
                profiles: {},
            },
            groups: {
                myGroups: [],
            },
            emojis: {
                customEmoji: {},
            },
            preferences: {
                myPreferences: {},
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
});
