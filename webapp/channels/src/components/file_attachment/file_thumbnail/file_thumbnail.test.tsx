// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

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

        const image = container.querySelector('.post-image.small');
        expect(image).toBeInTheDocument();
        expect(image).toHaveStyle({backgroundImage: `url(api/v4/files/${fileInfo.id}/thumbnail)`});
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

        const image = container.querySelector('.post-image.normal');
        expect(image).toBeInTheDocument();
        expect(image).toHaveStyle({backgroundImage: `url(api/v4/files/${fileInfo.id}/thumbnail)`});
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

        render(<FileThumbnail {...props}/>);

        const image = screen.getByRole('img', {name: 'file thumbnail image'});
        expect(image).toBeInTheDocument();
        expect(image).toHaveClass('post-image', 'normal');
        expect(image).toHaveAttribute('src', `api/v4/files/${fileInfo.id}`);
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

        const icon = container.querySelector('.file-icon');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('svg');
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

        const icon = container.querySelector('.file-icon');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveClass('pdf');
    });
});
