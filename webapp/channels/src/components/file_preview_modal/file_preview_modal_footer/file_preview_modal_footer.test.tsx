// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import FilePreviewModalFooter from './file_preview_modal_footer';

jest.mock('../file_preview_modal_info/file_preview_modal_info', () => () => <div>{'FilePreviewModalInfo'}</div>);
jest.mock('../file_preview_modal_main_actions/file_preview_modal_main_actions', () => () => (
    <div>{'FilePreviewModalMainActions'}</div>
));

describe('components/file_preview_modal/file_preview_modal_footer/FilePreviewModalFooter', () => {
    const defaultProps = {
        enablePublicLink: false,
        fileInfo: TestHelper.getFileInfoMock(),
        canDownloadFiles: true,
        fileURL: 'https://example.com/img.png',
        filename: 'img.png',
        isMobile: false,
        fileIndex: 1,
        totalFiles: 3,
        post: TestHelper.getPostMock(),
        showPublicLink: false,
        isExternalFile: false,
        onGetPublicLink: jest.fn(),
        handleModalClose: jest.fn(),
        content: '',
        canCopyContent: false,
    };

    test('should match snapshot the desktop view', () => {
        const props = {
            ...defaultProps,
        };

        const {container} = renderWithContext(<FilePreviewModalFooter {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot the mobile view', () => {
        const props = {
            ...defaultProps,
            isMobile: true,
        };

        const {container} = renderWithContext(<FilePreviewModalFooter {...props}/>);
        expect(container).toMatchSnapshot();
    });
});
