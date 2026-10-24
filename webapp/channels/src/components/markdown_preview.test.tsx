// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MarkdownPreview, {isMarkdownFile} from 'components/markdown_preview';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

describe('components/MarkdownPreview', () => {
    const fileUrl = 'https://example.com/api/v4/files/file_id';
    const requiredProps = {
        fileInfo: TestHelper.getFileInfoMock({
            id: 'file_id',
            name: 'readme.md',
            extension: 'md',
            size: 100,
        }),
        fileUrl,
    };

    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('isMarkdownFile returns true for markdown extensions', () => {
        expect(isMarkdownFile(TestHelper.getFileInfoMock({extension: 'md'}))).toBe(true);
        expect(isMarkdownFile(TestHelper.getFileInfoMock({extension: 'mkd'}))).toBe(true);
        expect(isMarkdownFile(TestHelper.getFileInfoMock({extension: 'mkdown'}))).toBe(true);
        expect(isMarkdownFile(TestHelper.getFileInfoMock({extension: 'js'}))).toBe(false);
        expect(isMarkdownFile(TestHelper.getFileInfoMock({extension: 'mk'}))).toBe(false);
    });

    test('should show loading spinner initially', () => {
        global.fetch = jest.fn().mockImplementation(() => new Promise(() => { /* never resolves */ }));

        const {container} = renderWithContext(
            <MarkdownPreview {...requiredProps}/>,
        );

        expect(container.querySelector('.view-image__loading')).toBeInTheDocument();
    });

    test('should render markdown content after fetch succeeds', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('# Hello\n\nThis is **bold** text'),
        });

        renderWithContext(
            <MarkdownPreview {...requiredProps}/>,
        );

        await waitFor(() => {
            expect(screen.getByText('Hello')).toBeInTheDocument();
        });

        expect(screen.getByText('readme.md')).toBeInTheDocument();
        expect(screen.getByText('bold')).toBeInTheDocument();
        expect(document.querySelector('.markdown-preview')).toBeInTheDocument();
    });

    test('should call getContent with raw markdown source', async () => {
        const raw = '# Title\n\nBody content';
        const getContent = jest.fn();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(raw),
        });

        renderWithContext(
            <MarkdownPreview
                {...requiredProps}
                getContent={getContent}
            />,
        );

        await waitFor(() => {
            expect(getContent).toHaveBeenCalledWith(raw);
        });
    });

    test('should clear parent content when fetch fails or file is too large', async () => {
        const raw = '# Title\n\nBody content';
        const getContent = jest.fn();
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(raw),
        });

        const {rerender} = renderWithContext(
            <MarkdownPreview
                {...requiredProps}
                getContent={getContent}
            />,
        );

        await waitFor(() => {
            expect(getContent).toHaveBeenCalledWith(raw);
        });

        // Fetch failure: same fileUrl so mount/file-selection cleanup does not run; only size change
        // re-triggers the fetch effect.
        getContent.mockClear();
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            text: () => Promise.resolve(''),
        });

        rerender(
            <MarkdownPreview
                {...requiredProps}
                fileInfo={TestHelper.getFileInfoMock({
                    ...requiredProps.fileInfo,
                    size: requiredProps.fileInfo.size + 1,
                })}
                getContent={getContent}
            />,
        );

        await waitFor(() => {
            expect(document.querySelector('.file-details__name')).toBeInTheDocument();
        });
        expect(getContent).toHaveBeenCalledWith('');
        expect(getContent).not.toHaveBeenCalledWith(raw);

        // Oversized file: again keep fileUrl stable so only the size-gate branch clears content.
        getContent.mockClear();
        global.fetch = jest.fn();

        rerender(
            <MarkdownPreview
                {...requiredProps}
                fileInfo={TestHelper.getFileInfoMock({
                    ...requiredProps.fileInfo,
                    name: 'large.md',
                    size: Constants.CODE_PREVIEW_MAX_FILE_SIZE + 1,
                })}
                getContent={getContent}
            />,
        );

        await waitFor(() => {
            expect(getContent).toHaveBeenCalledWith('');
        });
        expect(global.fetch).not.toHaveBeenCalled();
        expect(getContent).not.toHaveBeenCalledWith(raw);
    });

    test('should escape HTML tags instead of rendering them', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('Hello <b>world</b> <script>alert(1)</script>'),
        });

        const {container} = renderWithContext(
            <MarkdownPreview {...requiredProps}/>,
        );

        await waitFor(() => {
            expect(container.querySelector('.markdown-preview')).toBeInTheDocument();
        });

        expect(container.querySelector('script')).not.toBeInTheDocument();
        expect(container.querySelector('b')).not.toBeInTheDocument();
        expect(container.textContent).toContain('<b>world</b>');
        expect(container.textContent).toContain('<script>alert(1)</script>');
    });

    test('should fall back to FileInfoPreview when file is too large', async () => {
        global.fetch = jest.fn();

        const props = {
            ...requiredProps,
            fileInfo: TestHelper.getFileInfoMock({
                id: 'file_id',
                name: 'large.md',
                extension: 'md',
                size: Constants.CODE_PREVIEW_MAX_FILE_SIZE + 1,
            }),
        };

        renderWithContext(
            <MarkdownPreview {...props}/>,
        );

        await waitFor(() => {
            expect(document.querySelector('.file-details__name')).toBeInTheDocument();
        });

        expect(document.querySelector('.markdown-preview')).not.toBeInTheDocument();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should fall back to FileInfoPreview when fetch fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            text: () => Promise.resolve(''),
        });

        renderWithContext(
            <MarkdownPreview {...requiredProps}/>,
        );

        await waitFor(() => {
            expect(document.querySelector('.file-details__name')).toBeInTheDocument();
        });

        expect(document.querySelector('.markdown-preview')).not.toBeInTheDocument();
    });
});
