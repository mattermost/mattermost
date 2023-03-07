// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import {FileInfo} from '@mattermost/types/files';
import FileInfoPreview from 'components/file_info_preview/file_info_preview';

describe('components/FileInfoPreview', () => {
    test('should match snapshot, can download files', () => {
        const wrapper = shallow(
            <FileInfoPreview
                fileUrl='https://pre-release.mattermost.com/api/v4/files/rqir81f7a7ft8m6j6ej7g1txuo'
                fileInfo={{name: 'Test Image', size: 100, extension: 'jpg'} as FileInfo}
                canDownloadFiles={true}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, cannot download files', () => {
        const wrapper = shallow(
            <FileInfoPreview
                fileUrl='https://pre-release.mattermost.com/api/v4/files/aasf9afshaskj1asf91jasf0a0'
                fileInfo={{name: 'Test Image 2', size: 200, extension: 'png'} as FileInfo}
                canDownloadFiles={false}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
