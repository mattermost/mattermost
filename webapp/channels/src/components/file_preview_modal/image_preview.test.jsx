// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import ImagePreview from 'components/file_preview_modal/image_preview';

describe('components/view_image/ImagePreview', () => {
    const baseProps = {
        canDownloadFiles: true,
        fileInfo: {
            id: 'file_id',
        },
    };

    test('should match snapshot, without preview', () => {
        const wrapper = shallow(
            <ImagePreview {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with preview', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                id: 'file_id_1',
                has_preview_image: true,
            },
        };

        const wrapper = shallow(
            <ImagePreview {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, without preview, cannot download', () => {
        const props = {
            ...baseProps,
            canDownloadFiles: false,
        };

        const wrapper = shallow(
            <ImagePreview {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with preview, cannot download', () => {
        const props = {
            ...baseProps,
            canDownloadFiles: false,
            fileInfo: {
                id: 'file_id_1',
                has_preview_image: true,
            },
        };

        const wrapper = shallow(
            <ImagePreview {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should not download link for external file', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                link: 'https://example.com/image.png',
            },
        };

        const wrapper = shallow(
            <ImagePreview {...props}/>,
        );

        expect(wrapper.find('a').prop('href')).toBe('#');
        expect(wrapper.find('img').prop('src')).toBe(props.fileInfo.link);
    });
});
