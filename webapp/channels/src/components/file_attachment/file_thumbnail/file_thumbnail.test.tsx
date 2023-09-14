// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import FileThumbnail from './file_thumbnail';

describe('FileThumbnail', () => {
    const fileInfo = {
        id: 'thumbnail_id',
        extension: 'jpg',
        width: 100,
        height: 80,
        has_preview_image: true,
        user_id: '',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        name: '',
        size: 100,
        mime_type: '',
        clientId: '',
        archived: false,
    };
    const baseProps = {
        fileInfo,
        enableSVGs: false,
    };

    test('should render a small image', () => {
        const wrapper = shallow(
            <FileThumbnail {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should render a normal-sized image', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...fileInfo,
                height: 150,
                width: 150,
            },
        };

        const wrapper = shallow(
            <FileThumbnail {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should render an svg when svg previews are enabled', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...fileInfo,
                extension: 'svg',
            },
            enableSVGs: true,
        };

        const wrapper = shallow(
            <FileThumbnail {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('img').exists()).toBe(true);
    });

    test('should render an icon for an SVG when SVG previews are disabled', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...fileInfo,
                extension: 'svg',
            },
            enableSVGs: false,
        };

        const wrapper = shallow(
            <FileThumbnail {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('div.file-icon').exists()).toBe(true);
    });

    test('should render an icon for a PDF', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...fileInfo,
                extension: 'pdf',
            },
        };

        const wrapper = shallow(
            <FileThumbnail {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('div.file-icon').exists()).toBe(true);
    });
});
