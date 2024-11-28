// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import {renderWithIntl} from 'tests/react_testing_utils';

import FileUploadOverlay from './file_upload_overlay';

describe('components/FileUploadOverlay', () => {
    test('should render correctly with no overlay type', () => {
        renderWithIntl(
            <FileUploadOverlay
                overlayType=''
            />,
        );

        const overlay = screen.getByTestId('fileUploadOverlay');
        expect(overlay).toBeInTheDocument();
        expect(overlay).toHaveClass('file-overlay hidden');
        expect(overlay).not.toHaveClass('right-file-overlay');
        expect(overlay).not.toHaveClass('center-file-overlay');

        expect(screen.getByText('Drop a file to upload it.')).toBeInTheDocument();
        expect(screen.getByAltText('Files')).toBeInTheDocument();
        expect(screen.getByAltText('Logo')).toBeInTheDocument();
        expect(screen.getByTitle('Upload Icon')).toBeInTheDocument();
    });

    test('should render correctly with right overlay type', () => {
        renderWithIntl(
            <FileUploadOverlay
                overlayType='right'
            />,
        );

        const overlay = screen.getByTestId('fileUploadOverlay');
        expect(overlay).toBeInTheDocument();
        expect(overlay).toHaveClass('file-overlay hidden right-file-overlay');
    });

    test('should render correctly with center overlay type', () => {
        renderWithIntl(
            <FileUploadOverlay
                overlayType='center'
            />,
        );

        const overlay = screen.getByTestId('fileUploadOverlay');
        expect(overlay).toBeInTheDocument();
        expect(overlay).toHaveClass('file-overlay hidden center-file-overlay');
    });
});
