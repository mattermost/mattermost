// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';

import DialogRouter from './dialog_router';

import type {PropsFromRedux} from './index';

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
    const baseProps: Partial<PropsFromRedux> & Pick<PropsFromRedux, 'emojiMap' | 'isAppsFormEnabled' | 'hasUrl' | 'actions'> & {onExited?: () => void} = {
        url: 'http://example.com',
        callbackId: 'abc123',
        elements: [],
        title: 'Test Dialog',
        introductionText: 'Test introduction',
        iconUrl: 'http://example.com/icon.png',
        submitLabel: 'Submit',
        notifyOnCancel: true,
        state: 'test-state',
        emojiMap: new (require('utils/emoji_map').default)(new Map()),
        isAppsFormEnabled: true,
        hasUrl: true,
        actions: {
            submitInteractiveDialog: jest.fn(),
            lookupInteractiveDialog: jest.fn(),
        },
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Component Selection Logic', () => {
        test('should render InteractiveDialogAdapter when apps form is enabled and URL is present', () => {
            const {getByTestId} = render(
                <DialogRouter {...baseProps}/>,
            );

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
            expect(getByTestId('adapter-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('adapter-url')).toHaveTextContent('http://example.com');
            expect(getByTestId('adapter-callback-id')).toHaveTextContent('abc123');
        });

        test('should render InteractiveDialog when apps form is disabled', () => {
            const propsWithAppsFormDisabled = {
                ...baseProps,
                isAppsFormEnabled: false,
            };

            const {getByTestId} = render(
                <DialogRouter {...propsWithAppsFormDisabled}/>,
            );

            expect(getByTestId('interactive-dialog')).toBeInTheDocument();
            expect(getByTestId('legacy-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('legacy-url')).toHaveTextContent('http://example.com');
            expect(getByTestId('legacy-callback-id')).toHaveTextContent('abc123');
        });

        test('should return null when URL is missing (configuration error)', () => {
            const propsWithoutUrl = {
                ...baseProps,
                hasUrl: false,
            };

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const {container} = render(
                <DialogRouter {...propsWithoutUrl}/>,
            );

            expect(container.firstChild).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('Interactive dialog missing URL - this is a configuration error');

            consoleSpy.mockRestore();
        });
    });
});
