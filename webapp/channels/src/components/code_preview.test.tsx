// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import CodePreview from './code_preview';

describe('components/CodePreview', () => {
    const source = '# Title\n\nSome *emphasis*';
    const fileInfo = TestHelper.getFileInfoMock({id: 'file_id', name: 'notes.md', extension: 'md', size: source.length});
    const fileUrl = 'http://localhost/api/v4/files/file_id';

    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({ok: true, text: () => Promise.resolve(source)});
    });

    test('should show highlighted source by default', async () => {
        const getContent = jest.fn();
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
                getContent={getContent}
            />,
        );

        await waitFor(() => expect(container.querySelector('.hljs code')).toBeInTheDocument());
        expect(screen.queryByRole('heading', {name: 'Title'})).not.toBeInTheDocument();
        expect(container.querySelector('.code-preview')).toHaveClass('code-preview--wrap');
        expect(container.querySelector('.post-code__line-numbers')).not.toBeInTheDocument();
        expect(getContent).toHaveBeenCalledWith(source);
    });

    test('should render the markdown when renderMarkdown is set and still report the raw source', async () => {
        const getContent = jest.fn();
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
                getContent={getContent}
                renderMarkdown={true}
            />,
        );

        expect(await screen.findByRole('heading', {level: 1, name: 'Title'})).toBeInTheDocument();
        expect(container.querySelector('.code-preview--markdown')).toBeInTheDocument();
        expect(container.querySelector('.post-code__line-numbers')).not.toBeInTheDocument();
        expect(getContent).toHaveBeenCalledWith(source);
    });

    test('should not refetch when switching between rendered and raw', async () => {
        const {rerender} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
                renderMarkdown={true}
            />,
        );
        await screen.findByRole('heading', {name: 'Title'});

        rerender(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
                renderMarkdown={false}
            />,
        );

        await waitFor(() => expect(screen.queryByRole('heading', {name: 'Title'})).not.toBeInTheDocument());
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should ignore renderMarkdown for non-markdown files', async () => {
        const jsFile = TestHelper.getFileInfoMock({id: 'js_id', name: 'a.js', extension: 'js', size: 10});
        global.fetch = jest.fn().mockResolvedValue({ok: true, text: () => Promise.resolve('# not markdown')});
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={jsFile}
                fileUrl={fileUrl}
                renderMarkdown={true}
            />,
        );

        await waitFor(() => expect(container.querySelector('.post-code__line-numbers')).toBeInTheDocument());
        expect(container.querySelector('.code-preview--markdown')).not.toBeInTheDocument();
    });

    test('should use the same fixed-size box for markdown files in both views', async () => {
        const {container, rerender} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
                renderMarkdown={true}
            />,
        );
        await screen.findByRole('heading', {name: 'Title'});
        expect(container.querySelector('.code-preview')).toHaveClass('code-preview--fixed-size');

        rerender(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
                renderMarkdown={false}
            />,
        );
        await waitFor(() => expect(container.querySelector('.hljs code')).toBeInTheDocument());
        expect(container.querySelector('.code-preview')).toHaveClass('code-preview--fixed-size');
    });

    test('should not fix the size of other code files', async () => {
        const jsFile = TestHelper.getFileInfoMock({id: 'js_id', name: 'a.js', extension: 'js', size: 10});
        global.fetch = jest.fn().mockResolvedValue({ok: true, text: () => Promise.resolve('const a = 1;')});
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={jsFile}
                fileUrl={fileUrl}
            />,
        );

        await waitFor(() => expect(container.querySelector('.post-code__line-numbers')).toBeInTheDocument());
        expect(container.querySelector('.code-preview')).not.toHaveClass('code-preview--fixed-size');
        expect(container.querySelector('.code-preview')).not.toHaveClass('code-preview--wrap');
    });
});
