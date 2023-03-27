// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import FilePreviewModalMainNav from './file_preview_modal_main_nav';

describe('components/file_preview_modal/file_preview_modal_main_nav/FilePreviewModalMainNav', () => {
    const defaultProps = {
        fileIndex: 1,
        totalFiles: 2,
        handlePrev: jest.fn(),
        handleNext: jest.fn(),
    };

    test('should match snapshot with multiple files', () => {
        const props = {
            ...defaultProps,
            enablePublicLink: false,
        };

        const wrapper = shallow(<FilePreviewModalMainNav {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
