// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import FilePreviewModalHeader from './file_preview_modal_header';

import type {Post} from '@mattermost/types/posts';

describe('components/file_preview_modal/file_preview_modal_header/FilePreviewModalHeader', () => {
    const defaultProps = {
        enablePublicLink: false,
        canDownloadFiles: true,
        fileURL: 'http://example.com/img.png',
        filename: 'img.png',
        fileInfo: TestHelper.getFileInfoMock({}),
        isMobileView: false,
        fileIndex: 1,
        totalFiles: 3,
        post: {} as Post,
        showPublicLink: false,
        isExternalFile: false,
        onGetPublicLink: jest.fn(),
        handlePrev: jest.fn(),
        handleNext: jest.fn(),
        handleModalClose: jest.fn(),
        content: '',
        canCopyContent: true,
    };

    test('should match snapshot the desktop view', () => {
        const props = {
            ...defaultProps,
        };

        const wrapper = shallow(<FilePreviewModalHeader {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot the mobile view', () => {
        const props = {
            ...defaultProps,
            isMobileView: true,
        };

        const wrapper = shallow(<FilePreviewModalHeader {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
