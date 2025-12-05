// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FileUploadOverlay from 'components/file_upload_overlay/index';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/FileUploadOverlay', () => {
    test('should match snapshot when file upload is showing with no overlay type', () => {
        const {container} = renderWithContext(
            <FileUploadOverlay
                overlayType=''
                id={'fileUploadOverlay'}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when file upload is showing with overlay type of right', () => {
        const {container} = renderWithContext(
            <FileUploadOverlay
                overlayType='right'
                id={'fileUploadOverlay'}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when file upload is showing with overlay type of center', () => {
        const {container} = renderWithContext(
            <FileUploadOverlay
                overlayType='center'
                id={'fileUploadOverlay'}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
