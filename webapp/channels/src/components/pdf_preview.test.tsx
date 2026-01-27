// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PDFPreview from 'components/pdf_preview';
import type {Props} from 'components/pdf_preview';

import {fireEvent, renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

jest.mock('pdfjs-dist', () => ({
    getDocument: () => Promise.resolve({
        numPages: 3,
        getPage: (i: number) => Promise.resolve({
            pageIndex: i,
            getContext: (s: string) => Promise.resolve({s}),
        }),
    }),
}));

describe('component/PDFPreview', () => {
    const requiredProps: Props = {
        fileInfo: TestHelper.getFileInfoMock({extension: 'pdf'}),
        fileUrl: 'https://pre-release.mattermost.com/api/v4/files/ips59w4w9jnfbrs3o94m1dbdie',
        scale: 1,
        handleBgClose: jest.fn(),
    };

    /**
     * All tests fail because 'onDocumentLoadError' is called every time.
     * Tests on 'master' branch pass because they're testing state and snapshots, not how
     * the user would use the app. Delete this comment after resolution during review.
     */

    test('should show loading spinner when loading', () => {
        const {getByTestId} = renderWithContext(<PDFPreview {...requiredProps}/>);

        const loadingSpinner = getByTestId('loadingSpinner');

        expect(loadingSpinner).toBeInTheDocument();
        expect(loadingSpinner).toBeVisible();
    });

    test('should show file details on fail', () => {
        const updatedProps: Props = {...requiredProps, fileUrl: ''};

        const {getByTestId} = renderWithContext(<PDFPreview {...updatedProps}/>);

        const fileDetailsContainer = getByTestId('file-details__container');

        expect(fileDetailsContainer).toBeInTheDocument();
        expect(fileDetailsContainer).toBeVisible();

        expect(getByTestId('loadingSpinner')).not.toBeInTheDocument();
    });

    test('should call handleBgClose when clicked', () => {
        const {getByTestId} = renderWithContext(<PDFPreview {...requiredProps}/>);

        fireEvent.click(getByTestId('pdf-container'));

        expect(requiredProps.handleBgClose).toHaveBeenCalledTimes(1);
    });
});
