// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithIntl} from 'tests/react_testing_utils';

import FileUploadOverlay from './index';

describe('components/FileUploadOverlay', () => {
    test('should match snapshot when file upload is showing with no overlay type', () => {
        const {container} = renderWithIntl(
            <FileUploadOverlay
                overlayType=''
                id={'fileUploadOverlay'}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when file upload is showing with overlay type of right', () => {
        const {container} = renderWithIntl(
            <FileUploadOverlay
                overlayType='right'
                id={'fileUploadOverlay'}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when file upload is showing with overlay type of center', () => {
        const {container} = renderWithIntl(
            <FileUploadOverlay
                overlayType='center'
                id={'fileUploadOverlay'}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
