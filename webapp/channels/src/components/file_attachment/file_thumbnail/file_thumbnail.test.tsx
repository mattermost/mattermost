// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/react_testing_utils';

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
        const {container} = render(
            <FileThumbnail {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
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

        const {container} = render(
            <FileThumbnail {...props}/>,
        );

        expect(container).toMatchSnapshot();
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

        const {container} = render(
            <FileThumbnail {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(container.querySelector('img')).toBeInTheDocument();
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

        const {container} = render(
            <FileThumbnail {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(container.querySelector('div.file-icon')).toBeInTheDocument();
    });

    test('should render an icon for a PDF', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...fileInfo,
                extension: 'pdf',
            },
        };

        const {container} = render(
            <FileThumbnail {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(container.querySelector('div.file-icon')).toBeInTheDocument();
    });

    test('should render an icon for a PSD (MM-67077)', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...fileInfo,
                extension: 'psd',
            },
        };

        const {container} = render(
            <FileThumbnail {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(container.querySelector('div.file-icon')).toBeInTheDocument();
    });
});
