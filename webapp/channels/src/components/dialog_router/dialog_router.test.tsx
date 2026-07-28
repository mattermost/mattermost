// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';

import DialogRouter from './dialog_router';

import type {PropsFromRedux} from './index';

jest.mock('./blocks_dialog_shell', () => {
    return function MockBlocksDialogShell(props: any) {
        return (
            <div data-testid='blocks-dialog-shell'>
                <div data-testid='shell-mode'>{props.mode}</div>
                <div data-testid='shell-title'>{props.title}</div>
                <div data-testid='shell-url'>{props.url}</div>
                <div data-testid='shell-callback-id'>{props.callbackId}</div>
                <div data-testid='shell-blocks-count'>{props.mmBlocks?.length ?? 0}</div>
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
    const baseProps: Partial<PropsFromRedux> & Pick<PropsFromRedux, 'emojiMap' | 'hasUrl' | 'hasContent' | 'actions'> & {onExited?: () => void} = {
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
        hasMmBlocks: false,
        hasContent: true,
        mmBlocksEnabled: true,
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
        test('should render legacy BlocksDialogShell when URL is present and MmBlocksEnabled', () => {
            const {getByTestId} = render(
                <DialogRouter {...baseProps}/>,
            );

            expect(getByTestId('blocks-dialog-shell')).toBeInTheDocument();
            expect(getByTestId('shell-mode')).toHaveTextContent('legacy');
            expect(getByTestId('shell-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('shell-url')).toHaveTextContent('http://example.com');
            expect(getByTestId('shell-callback-id')).toHaveTextContent('abc123');
        });

        test('should render native BlocksDialogShell when mm_blocks are present and MmBlocksEnabled', () => {
            const props = {
                ...baseProps,
                hasUrl: false,
                hasMmBlocks: true,
                hasContent: true,
                mmBlocks: [{type: 'text', text: 'Hello'}],
                mmBlocksActions: 'encrypted-cookie',
                title: undefined,
                url: undefined,
            };

            const {getByTestId} = render(
                <DialogRouter {...props}/>,
            );

            expect(getByTestId('shell-mode')).toHaveTextContent('native');
            expect(getByTestId('shell-blocks-count')).toHaveTextContent('1');
        });

        test('should render AppsForm InteractiveDialogAdapter when MmBlocksEnabled is off', () => {
            const props = {
                ...baseProps,
                mmBlocksEnabled: false,
                hasMmBlocks: false,
            };

            const {getByTestId, queryByTestId} = render(
                <DialogRouter {...props}/>,
            );

            expect(getByTestId('interactive-dialog-adapter')).toBeInTheDocument();
            expect(queryByTestId('blocks-dialog-shell')).not.toBeInTheDocument();
            expect(getByTestId('adapter-title')).toHaveTextContent('Test Dialog');
            expect(getByTestId('adapter-url')).toHaveTextContent('http://example.com');
        });

        test('should return null when MmBlocksEnabled is off and URL is missing', () => {
            const props = {
                ...baseProps,
                mmBlocksEnabled: false,
                hasUrl: false,
                hasMmBlocks: false,
                hasContent: true,
            };

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const {container} = render(
                <DialogRouter {...props}/>,
            );

            expect(container.firstChild).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('Interactive dialog missing URL - this is a configuration error');

            consoleSpy.mockRestore();
        });

        test('should return null when content is missing (configuration error)', () => {
            const propsWithoutContent = {
                ...baseProps,
                hasUrl: false,
                hasMmBlocks: false,
                hasContent: false,
            };

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            const {container} = render(
                <DialogRouter {...propsWithoutContent}/>,
            );

            expect(container.firstChild).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith('Interactive dialog missing URL or block_dialog - this is a configuration error');

            consoleSpy.mockRestore();
        });
    });

    describe('Props rendering', () => {
        test('passes props to the shell on initial render', () => {
            const propsA = {
                ...baseProps,
                url: 'http://dialog-a.example.com',
                title: 'Dialog A',
                callbackId: 'callback-a',
            };

            const {getByTestId} = render(<DialogRouter {...propsA}/>);

            expect(getByTestId('shell-url')).toHaveTextContent('http://dialog-a.example.com');
            expect(getByTestId('shell-title')).toHaveTextContent('Dialog A');
            expect(getByTestId('shell-callback-id')).toHaveTextContent('callback-a');
        });

        test('re-renders with updated props when parent provides new data', () => {
            const propsA = {
                ...baseProps,
                url: 'http://dialog-a.example.com',
                title: 'Dialog A',
                callbackId: 'callback-a',
            };

            const {getByTestId, rerender} = render(<DialogRouter {...propsA}/>);

            expect(getByTestId('shell-url')).toHaveTextContent('http://dialog-a.example.com');

            const propsB = {
                ...baseProps,
                url: 'http://dialog-b.example.com',
                title: 'Dialog B',
                callbackId: 'callback-b',
            };

            rerender(<DialogRouter {...propsB}/>);

            expect(getByTestId('shell-url')).toHaveTextContent('http://dialog-b.example.com');
            expect(getByTestId('shell-title')).toHaveTextContent('Dialog B');
            expect(getByTestId('shell-callback-id')).toHaveTextContent('callback-b');
        });
    });
});
