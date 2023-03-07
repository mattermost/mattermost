// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {TestHelper} from 'utils/test_helper';

import AudioVideoPreview from './audio_video_preview';

describe('AudioVideoPreview', () => {
    const baseProps = {
        fileInfo: TestHelper.getFileInfoMock({
            extension: 'mov',
            id: 'file_id',
        }),
        fileUrl: '/api/v4/files/file_id',
        isMobileView: false,
    };

    test('should match snapshot without children', () => {
        const wrapper = shallow(
            <AudioVideoPreview {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, cannot play', () => {
        const wrapper = shallow(
            <AudioVideoPreview {...baseProps}/>,
        );
        wrapper.setState({canPlay: false});
        expect(wrapper).toMatchSnapshot();
    });
});
