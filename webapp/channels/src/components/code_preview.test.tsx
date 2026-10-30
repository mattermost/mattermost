// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import LocalStorageStore from 'stores/local_storage_store';

import {act, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import CodePreview, {canToggleMarkdownPreview} from './code_preview';

describe('components/CodePreview', () => {
    const source = '# Title\n\nSome *emphasis*';
    const fileInfo = TestHelper.getFileInfoMock({id: 'file_id', name: 'notes.md', extension: 'md', size: source.length});
    const fileUrl = 'http://localhost/api/v4/files/file_id';

    // The same stored choice the header toggle writes, which every mounted preview follows
    const chooseView = (view: 'rendered' | 'raw') => {
        LocalStorageStore.setMarkdownView('file_preview', '', view);
        act(() => {
            window.dispatchEvent(new Event('storage'));
        });
    };

    beforeEach(() => {
        localStorage.clear();
        global.fetch = jest.fn().mockResolvedValue({ok: true, text: () => Promise.resolve(source)});
    });

    test('should show highlighted source in the raw view', async () => {
        chooseView('raw');
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

        // One numbered row per source line, so numbers stay with their line when it wraps
        expect(container.querySelector('.post-code__line-numbers')).not.toBeInTheDocument();
        expect(Array.from(container.querySelectorAll('.post-code__line-text')).map((n) => n.textContent)).toEqual(['# Title', '', 'Some *emphasis*']);
        expect(getContent).toHaveBeenCalledWith(source);
    });

    test('should render the markdown when the stored view is rendered and still report the raw source', async () => {
        const getContent = jest.fn();
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
                getContent={getContent}
            />,
        );

        expect(await screen.findByRole('heading', {level: 1, name: 'Title'})).toBeInTheDocument();
        expect(container.querySelector('.code-preview--markdown')).toBeInTheDocument();
        expect(container.querySelector('.post-code__line-numbers')).not.toBeInTheDocument();
        expect(getContent).toHaveBeenCalledWith(source);
    });

    test('should not refetch when switching between rendered and raw', async () => {
        renderWithContext(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
            />,
        );
        await screen.findByRole('heading', {name: 'Title'});

        chooseView('raw');

        await waitFor(() => expect(screen.queryByRole('heading', {name: 'Title'})).not.toBeInTheDocument());
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    test('should not render non-markdown files as markdown', async () => {
        const jsFile = TestHelper.getFileInfoMock({id: 'js_id', name: 'a.js', extension: 'js', size: 10});
        global.fetch = jest.fn().mockResolvedValue({ok: true, text: () => Promise.resolve('# not markdown')});
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={jsFile}
                fileUrl={fileUrl}
            />,
        );

        await waitFor(() => expect(container.querySelector('.post-code__line-numbers')).toBeInTheDocument());
        expect(container.querySelector('.code-preview--markdown')).not.toBeInTheDocument();
    });

    test('should use the same fixed-size box for markdown files in both views', async () => {
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
            />,
        );
        await screen.findByRole('heading', {name: 'Title'});
        expect(container.querySelector('.code-preview')).toHaveClass('code-preview--fixed-size');

        chooseView('raw');
        await waitFor(() => expect(container.querySelector('.hljs code')).toBeInTheDocument());
        expect(container.querySelector('.code-preview')).toHaveClass('code-preview--fixed-size');
    });

    test('should show the source on mobile even when the stored view is rendered', async () => {
        const {container} = renderWithContext(
            <CodePreview
                fileInfo={fileInfo}
                fileUrl={fileUrl}
                isMobileView={true}
            />,
        );

        await waitFor(() => expect(container.querySelector('.hljs code')).toBeInTheDocument());
        expect(screen.queryByRole('heading', {name: 'Title'})).not.toBeInTheDocument();
    });

    test('should only allow the toggle for markdown files outside the mobile view', () => {
        expect(canToggleMarkdownPreview('md', false)).toBe(true);
        expect(canToggleMarkdownPreview('md', true)).toBe(false);
        expect(canToggleMarkdownPreview('js', false)).toBe(false);
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
