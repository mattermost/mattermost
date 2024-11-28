// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, render} from '@testing-library/react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import React from 'react';

import PDFPreview from 'components/pdf_preview';
import type {Props} from 'components/pdf_preview';

import {TestHelper} from 'utils/test_helper';
import {renderWithIntl} from 'tests/react_testing_utils';

jest.mock('pdfjs-dist', () => ({
    getDocument: () => Promise.resolve({
        numPages: 3,
        getPage: (i: number) => Promise.resolve({
            pageIndex: i,
            getContext: (s: string) => Promise.resolve({s}),
        }),
    }),
}));

describe('components/PDFPreview', () => {
    const requiredProps: Props = {
        fileInfo: TestHelper.getFileInfoMock({extension: 'pdf'}),
        fileUrl: 'https://pre-release.mattermost.com/api/v4/files/ips59w4w9jnfbrs3o94m1dbdie',
        scale: 1,
        handleBgClose: jest.fn(),
    };

    test('should show loading spinner initially', () => {
        renderWithIntl(<PDFPreview {...requiredProps}/>);
        
        expect(screen.getByTitle('Loading Icon')).toBeInTheDocument();
        expect(screen.getByTitle('Loading Icon')).toHaveClass('fa fa-spinner fa-fw fa-pulse spinner');
    });

    test('should show file info preview when load fails', async () => {
        // Mock the PDF loading to fail
        jest.spyOn(console, 'log').mockImplementation(() => {});
        (pdfjsLib.getDocument as jest.Mock).mockRejectedValueOnce('error');

        renderWithIntl(<PDFPreview {...requiredProps}/>);

        // Wait for loading to finish
        expect(await screen.findByText(requiredProps.fileInfo.name)).toBeInTheDocument();
    });

    test('should update PDF preview when URL changes', async () => {
        const {rerender} = renderWithIntl(<PDFPreview {...requiredProps}/>);

        const newProps = {
            ...requiredProps,
            fileUrl: 'https://some-new-url',
        };

        rerender(<PDFPreview {...newProps}/>);

        // Should show loading state again
        expect(screen.getByTitle('Loading Icon')).toBeInTheDocument();
    });

    test('should render PDF pages when document loads successfully', async () => {
        renderWithIntl(<PDFPreview {...requiredProps}/>);

        // Initial loading state
        expect(screen.getByTitle('Loading Icon')).toBeInTheDocument();

        // Wait for canvas elements to be rendered (3 pages from mock)
        const canvases = await screen.findAllByRole('img');
        expect(canvases).toHaveLength(3);
    });
});
