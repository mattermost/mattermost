// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';

import DialogRouter from './dialog_router';

import type {PropsFromRedux} from './index';

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
    const baseProps: Partial<PropsFromRedux> & Pick<PropsFromRedux, 'emojiMap' | 'hasUrl' | 'actions'> & {onExited?: () => void} = {
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
        hasUrl: true,
        actions: {
            submitInteractiveDialog: jest.fn(),
            lookupInteractiveDialog: jest.fn(),
        },
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Component Selection Logic', () => {
        test('should render InteractiveDialogAdapter when URL is present', () => {
            const {getByTestId} = render(
                <DialogRouter {...baseProps}/>,
            );

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
            expect(getByTestId('adapter-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('adapter-url')).toHaveTextContent('http://example.com');
            expect(getByTestId('adapter-callback-id')).toHaveTextContent('abc123');
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

    describe('Mount-time props snapshot isolation', () => {
        // DialogRouter uses useState(() => props) to capture a snapshot of props at
        // mount time. This means that when the connected parent receives new Redux state
        // (e.g. a child dialog dispatched RECEIVED_DIALOG), this instance must continue
        // rendering with the ORIGINAL mount-time data — not the new data.

        test('passes mount-time props to the adapter on initial render', () => {
            const propsA = {
                ...baseProps,
                url: 'http://dialog-a.example.com',
                title: 'Dialog A',
                callbackId: 'callback-a',
            };

            const {getByTestId} = render(<DialogRouter {...propsA}/>);

            expect(getByTestId('adapter-url')).toHaveTextContent('http://dialog-a.example.com');
            expect(getByTestId('adapter-title')).toHaveTextContent('Dialog A');
            expect(getByTestId('adapter-callback-id')).toHaveTextContent('callback-a');
        });

        test('keeps showing mount-time data after parent rerenders with new props (snapshot isolation)', () => {
            // Simulate: first dialog opens → DialogRouter mounts with props A.
            const propsA = {
                ...baseProps,
                url: 'http://dialog-a.example.com',
                title: 'Dialog A',
                callbackId: 'callback-a',
            };

            const {getByTestId, rerender} = render(<DialogRouter {...propsA}/>);

            // Verify initial render shows Dialog A data.
            expect(getByTestId('adapter-url')).toHaveTextContent('http://dialog-a.example.com');

            // Simulate: a child dialog dispatches RECEIVED_DIALOG, connected parent
            // re-renders this instance with props B. The component must NOT update its
            // output — the useState snapshot freezes the data at mount time.
            const propsB = {
                ...baseProps,
                url: 'http://dialog-b.example.com',
                title: 'Dialog B',
                callbackId: 'callback-b',
            };

            rerender(<DialogRouter {...propsB}/>);

            // The adapter MUST still receive Dialog A's data, not Dialog B's.
            expect(getByTestId('adapter-url')).toHaveTextContent('http://dialog-a.example.com');
            expect(getByTestId('adapter-title')).toHaveTextContent('Dialog A');
            expect(getByTestId('adapter-callback-id')).toHaveTextContent('callback-a');
        });

        test('renders null and calls console.error when hasUrl is false', () => {
            const propsNoUrl = {
                ...baseProps,
                hasUrl: false as const,
                url: undefined,
            };

            const {container} = render(<DialogRouter {...propsNoUrl}/>);

            expect(container.firstChild).toBeNull();
            expect(console.error).toHaveBeenCalledWith(
                'Interactive dialog missing URL - this is a configuration error',
            );
        });
    });
});
