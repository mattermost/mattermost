// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ImagePreview from 'components/file_preview_modal/image_preview';

import {render, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

describe('components/view_image/ImagePreview', () => {
    const fileInfo1 = TestHelper.getFileInfoMock({id: 'file_id', extension: 'm4a', has_preview_image: false});
    const baseProps = {
        canDownloadFiles: true,
        fileInfo: fileInfo1,
    };

    test('should match snapshot, without preview', () => {
        const {container} = render(
            <ImagePreview {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with preview', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...fileInfo1,
                id: 'file_id_1',
                has_preview_image: true,
            },
        };

        const {container} = render(
            <ImagePreview {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without preview, cannot download', () => {
        const props = {
            ...baseProps,
            canDownloadFiles: false,
        };

        const {container} = render(
            <ImagePreview {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with preview, cannot download', () => {
        const props = {
            ...baseProps,
            canDownloadFiles: false,
            fileInfo: {
                ...fileInfo1,
                id: 'file_id_1',
                has_preview_image: true,
            },
        };

        const {container} = render(
            <ImagePreview {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should not download link for external file', () => {
        fileInfo1.link = 'https://example.com/image.png';
        const props = {
            ...baseProps,
            fileInfo: {
                ...fileInfo1,
                link: 'https://example.com/image.png',
                id: '',
            },
        };

        render(
            <ImagePreview {...props}/>,
        );

        expect(screen.getByRole('link')).toHaveAttribute('href', '#');
        expect(screen.getByTestId('imagePreview')).toHaveAttribute('src', props.fileInfo.link);
    });
});
