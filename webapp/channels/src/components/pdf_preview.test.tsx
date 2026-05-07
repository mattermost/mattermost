// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PDFPreview from 'components/pdf_preview';
import type {Props} from 'components/pdf_preview';

import {render, renderWithContext, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

const mockGetDocument = jest.fn();

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    getDocument: (params: unknown) => mockGetDocument(params),
}));

jest.mock('pdfjs-dist/build/pdf.worker.min.mjs', () => ({}));

describe('component/PDFPreview', () => {
    const requiredProps: Props = {
        fileInfo: TestHelper.getFileInfoMock({extension: 'pdf'}),
        fileUrl: 'https://pre-release.mattermost.com/api/v4/files/ips59w4w9jnfbrs3o94m1dbdie',
        scale: 1,
        handleBgClose: jest.fn(),
    };

    beforeEach(() => {
        mockGetDocument.mockReset();
        mockGetDocument.mockReturnValue({
            promise: Promise.resolve({
                numPages: 3,
                getPage: (i: number) => Promise.resolve({
                    pageIndex: i,
                    getViewport: () => ({height: 100, width: 100}),
                    render: () => ({promise: Promise.resolve()}),
                }),
            }),
        });
    });

    test('should match snapshot, loading', () => {
        const {container} = render(
            <PDFPreview {...requiredProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, not successful', async () => {
        // Mock PDF loading to fail
        mockGetDocument.mockReturnValue({
            promise: Promise.reject(new Error('Failed to load PDF')),
        });

        // Use renderWithContext because FileInfoPreview requires Redux store
        const {container} = renderWithContext(
            <PDFPreview {...requiredProps}/>,
        );

        // Wait for loading to complete (and fail)
        await waitFor(() => {
            expect(container.querySelector('.view-image__loading')).not.toBeInTheDocument();
        });

        expect(container).toMatchSnapshot();
    });

    test('should update state with new value from props when prop changes', async () => {
        const {container, rerender} = render(
            <PDFPreview {...requiredProps}/>,
        );

        // Wait for initial PDF to load
        await waitFor(() => {
            expect(container.querySelector('.post-code')).toBeInTheDocument();
        });

        const newFileUrl = 'https://some-new-url';

        // Rerender with new fileUrl - component should show loading state again
        rerender(
            <PDFPreview
                {...requiredProps}
                fileUrl={newFileUrl}
            />,
        );

        // Verify loading state is shown (state was reset due to new fileUrl)
        expect(container.querySelector('.view-image__loading')).toBeInTheDocument();

        // Wait for new PDF to load
        await waitFor(() => {
            expect(container.querySelector('.post-code')).toBeInTheDocument();
        });

        // Verify getDocument was called with new URL
        expect(mockGetDocument).toHaveBeenLastCalledWith(
            expect.objectContaining({url: newFileUrl}),
        );
    });

    test('should return correct state when onDocumentLoad is called', async () => {
        // Test with 0 pages
        mockGetDocument.mockReturnValueOnce({
            promise: Promise.resolve({
                numPages: 0,
                getPage: jest.fn(),
            }),
        });

        const {container, rerender} = render(
            <PDFPreview {...requiredProps}/>,
        );

        // Wait for PDF to load with 0 pages
        await waitFor(() => {
            expect(container.querySelector('.view-image__loading')).not.toBeInTheDocument();
        });

        // Should have 0 canvas elements
        expect(container.querySelectorAll('canvas')).toHaveLength(0);

        // Test with 100 pages
        mockGetDocument.mockReturnValueOnce({
            promise: Promise.resolve({
                numPages: 100,
                getPage: (i: number) => Promise.resolve({
                    pageIndex: i,
                    getViewport: () => ({height: 100, width: 100}),
                    render: () => ({promise: Promise.resolve()}),
                }),
            }),
        });

        const newFileUrl = 'https://another-url';
        rerender(
            <PDFPreview
                {...requiredProps}
                fileUrl={newFileUrl}
            />,
        );

        // Wait for new PDF to load
        await waitFor(() => {
            expect(container.querySelector('.post-code')).toBeInTheDocument();
        });

        // Should have 100 canvas elements
        expect(container.querySelectorAll('canvas')).toHaveLength(100);
    });
});
