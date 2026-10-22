// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext} from 'tests/react_testing_utils';
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
        const {container} = renderWithContext(
            <AudioVideoPreview {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, cannot play', () => {
        const {container} = renderWithContext(
            <AudioVideoPreview {...baseProps}/>,
        );

        // Trigger the error handler to set canPlay to false; fireEvent.error dispatches the <source> error (media load failure).
        const source = container.querySelector('source')!;
        fireEvent.error(source);

        expect(container).toMatchSnapshot();
    });
});
