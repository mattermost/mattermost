// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import type {PDFDocumentProxy} from 'pdfjs-dist';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import React from 'react';

import PDFPreview from 'components/pdf_preview';
import type {Props} from 'components/pdf_preview';

import {TestHelper} from 'utils/test_helper';
import {renderWithIntl} from 'tests/react_testing_utils';

jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    getDocument: jest.fn(),
}));

describe('components/PDFPreview', () => {
    const requiredProps: Props = {
        fileInfo: TestHelper.getFileInfoMock({extension: 'pdf'}),
        fileUrl: 'https://pre-release.mattermost.com/api/v4/files/ips59w4w9jnfbrs3o94m1dbdie',
        scale: 1,
        handleBgClose: jest.fn(),
    };

    test('should show loading spinner initially', async () => {
        // Mock PDF loading to be slow
        jest.spyOn(pdfjsLib, 'getDocument').mockImplementation(() => ({
            promise: new Promise(() => {}), // Never resolves
        }));
        
        renderWithIntl(<PDFPreview {...requiredProps}/>);
        
        const loadingIcon = await screen.findByTitle('Loading Icon');
        expect(loadingIcon).toBeInTheDocument();
    });

    test('should show file info preview when load fails', async () => {
        // Mock the PDF loading to fail
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(pdfjsLib, 'getDocument').mockImplementation(() => ({
            promise: Promise.reject(new Error('Failed to load PDF')),
        }));
        (pdfjsLib.getDocument as jest.Mock).mockImplementation(() => ({
            promise: Promise.reject(new Error('Failed to load PDF')),
        }));

        renderWithIntl(<PDFPreview {...requiredProps}/>);

        // Wait for loading to finish and verify file info is shown
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
        const mockPdf = {
            numPages: 3,
            getPage: jest.fn().mockImplementation((pageNum) => Promise.resolve({
                getViewport: () => ({height: 800, width: 600}),
                render: () => ({promise: Promise.resolve()}),
            })),
        };

        (pdfjsLib.getDocument as jest.Mock).mockImplementation(() => ({
            promise: Promise.resolve(mockPdf),
        }));

        renderWithIntl(<PDFPreview {...requiredProps}/>);

        // Initial loading state
        expect(screen.getByTitle('Loading Icon')).toBeInTheDocument();

        // Wait for canvas elements to be rendered
        const container = await screen.findByTestId('pdf-container');
        expect(container.querySelectorAll('canvas')).toHaveLength(3);
    });
});
