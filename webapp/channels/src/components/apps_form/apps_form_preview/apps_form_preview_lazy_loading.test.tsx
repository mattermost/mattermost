// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import AppsFormPreview from './apps_form_preview';

// pdf.js should load only when a preview shows a PDF. Jest loads a module once per file, so these
// tests live apart from those that render PDFs and must run in order.
jest.mock('components/pdf_preview', () => {
    (globalThis as {pdfPreviewModuleLoaded?: boolean}).pdfPreviewModuleLoaded = true;
    return jest.requireActual('components/pdf_preview');
});

const pdfPreviewModuleLoaded = () => Boolean((globalThis as {pdfPreviewModuleLoaded?: boolean}).pdfPreviewModuleLoaded);

const mockGetDocument = pdfjsLib.getDocument as jest.Mock;

describe('AppsFormPreview lazy loading of the PDF viewer', () => {
    const fileId = 'fileinfoid0000000000000000';

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('does not load the PDF viewer for image and file card previews', async () => {
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValueOnce(
            TestHelper.getFileInfoMock({id: fileId, name: 'photo.png', extension: 'png'}),
        );
        renderWithContext(<AppsFormPreview fileId={fileId}/>);
        await screen.findByRole('img', {name: 'photo.png'});

        jest.spyOn(Client4, 'getFileInfo').mockResolvedValueOnce(
            TestHelper.getFileInfoMock({id: fileId, name: 'load-plan.pdf', extension: 'pdf'}),
        );
        renderWithContext(
            <AppsFormPreview
                fileId={fileId}
                mode='file'
            />,
        );
        await screen.findByRole('link', {name: 'file thumbnail load-plan.pdf'});

        expect(pdfPreviewModuleLoaded()).toBe(false);
    });

    it('loads the PDF viewer for a PDF preview', async () => {
        mockGetDocument.mockReturnValue({
            promise: Promise.resolve({
                numPages: 1,
                getPage: () => Promise.resolve({
                    getViewport: () => ({width: 100, height: 100}),
                    render: () => ({promise: Promise.resolve()}),
                }),
            }),
            destroy: jest.fn(() => Promise.resolve()),
        });
        jest.spyOn(Client4, 'getFileInfo').mockResolvedValue(
            TestHelper.getFileInfoMock({id: fileId, name: 'load-plan.pdf', extension: 'pdf'}),
        );

        const {container} = renderWithContext(<AppsFormPreview fileId={fileId}/>);

        await waitFor(() => expect(container.querySelector('canvas')).toBeInTheDocument(), {timeout: 10000});
        expect(pdfPreviewModuleLoaded()).toBe(true);
    });
});
