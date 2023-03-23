// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import FileUploadOverlay from 'components/file_upload_overlay';

describe('components/FileUploadOverlay', () => {
    test('should match snapshot when file upload is showing with no overlay type', () => {
        const wrapper = shallow(
            <FileUploadOverlay
                overlayType=''
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when file upload is showing with overlay type of right', () => {
        const wrapper = shallow(
            <FileUploadOverlay
                overlayType='right'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when file upload is showing with overlay type of center', () => {
        const wrapper = shallow(
            <FileUploadOverlay
                overlayType='center'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
