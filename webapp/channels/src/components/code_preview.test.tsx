// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CodePreview from 'components/code_preview';

import {installMessageChannel} from 'tests/helpers/message_channel';
import {act, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import * as SyntaxHighlighting from 'utils/syntax_highlighting';
import {TestHelper} from 'utils/test_helper';

describe('components/CodePreview', () => {
    installMessageChannel();
    const files: Record<string, string> = {
        '/files/short': 'const shortFile = 1;',
        '/files/long': 'const longFile = 1;\n'.repeat(400),
    };

    let fetchSpy: jest.SpyInstance;
    let highlightSpy: jest.SpyInstance;

    beforeEach(() => {
        fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation((url) => Promise.resolve({
            ok: true,
            text: () => Promise.resolve(files[url as string]),
        } as Response));
        highlightSpy = jest.spyOn(SyntaxHighlighting, 'highlight');
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        highlightSpy.mockRestore();
    });

    const fileInfo = (name: string) => TestHelper.getFileInfoMock({name, extension: 'ts', size: 100});

    test('should show the language next to the file name for code that is highlighted', async () => {
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo('short.ts')}
                fileUrl='/files/short'
            />,
        );

        expect(await screen.findByText('short.ts - TypeScript')).toBeInTheDocument();
        await waitFor(() => {
            expect(container.querySelector('.hljs-keyword')).toBeInTheDocument();
        });
    });

    test('should show only the file name for code too long to highlight', async () => {
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo('long.ts')}
                fileUrl='/files/long'
            />,
        );

        expect(await screen.findByText('long.ts')).toBeInTheDocument();
        expect(screen.queryByText('long.ts - TypeScript')).not.toBeInTheDocument();
        expect(container.querySelector('.hljs-keyword')).not.toBeInTheDocument();
    });

    test('should not replace a newer file with the highlighted result of the previous one', async () => {
        let finishFirstHighlight: (value: string) => void = () => {};
        highlightSpy.mockImplementationOnce(() => new Promise<string>((resolve) => {
            finishFirstHighlight = resolve;
        }));

        const {container, rerender} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo('short.ts')}
                fileUrl='/files/short'
            />,
        );

        await waitFor(() => {
            expect(highlightSpy).toHaveBeenCalledTimes(1);
        });

        rerender(
            <CodePreview
                fileInfo={fileInfo('long.ts')}
                fileUrl='/files/long'
            />,
        );

        expect(await screen.findByText('long.ts')).toBeInTheDocument();

        await act(async () => {
            finishFirstHighlight('stale highlighted content');
        });

        expect(screen.getByText('long.ts')).toBeInTheDocument();
        expect(container.querySelector('code')).not.toHaveTextContent('stale highlighted content');
        expect(container.querySelector('code')).toHaveTextContent('const longFile = 1;');
    });
});
