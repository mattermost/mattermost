// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
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

    test('should apply transform when scale is provided and not 1', () => {
        const props = {
            ...baseProps,
            scale: 2,
        };

        render(<ImagePreview {...props}/>);

        expect(screen.getByTestId('imagePreview')).toHaveStyle('transform: scale(2)');
    });

    test('should not apply transform when scale is 1', () => {
        const props = {
            ...baseProps,
            scale: 1,
        };

        render(<ImagePreview {...props}/>);

        expect(screen.getByTestId('imagePreview').getAttribute('style') || '').not.toContain('transform');
    });

    test('should call onWheel handler when wheel event fires on image', () => {
        const onWheel = jest.fn();
        const props = {
            ...baseProps,
            onWheel,
        };

        render(<ImagePreview {...props}/>);

        fireEvent.wheel(screen.getByRole('link'), {deltaY: -100});
        expect(onWheel).toHaveBeenCalledTimes(1);
    });

    const svgFileInfo = (width: number, height: number) => TestHelper.getFileInfoMock({
        id: 'svg_file_id',
        extension: 'svg',
        width,
        height,
        has_preview_image: false,
    });

    test('should size an SVG from the dimensions the server derived', () => {
        const props = {
            ...baseProps,
            fileInfo: svgFileInfo(800, 600),
        };

        render(<ImagePreview {...props}/>);

        expect(screen.getByTestId('imagePreview')).toHaveStyle({width: '800px', height: 'auto'});
    });

    test('should size an SVG when downloads are disabled', () => {
        const props = {
            ...baseProps,
            canDownloadFiles: false,
            fileInfo: svgFileInfo(800, 600),
        };

        const {container} = render(<ImagePreview {...props}/>);

        expect(container.querySelector('img')).toHaveStyle({width: '800px', height: 'auto'});
    });

    test.each([
        ['no dimensions', 0],
        ['a negative width', -800],
    ])('should leave an SVG with %s to be sized by the browser', (_, width) => {
        const props = {
            ...baseProps,
            fileInfo: svgFileInfo(width, 600),
        };

        render(<ImagePreview {...props}/>);

        // Any width other than the SVG's own collapses or distorts it, so none may be applied
        expect(screen.getByTestId('imagePreview').style.width).toBe('');
    });

    test('should not size a non-SVG image from its file dimensions', () => {
        const props = {
            ...baseProps,
            fileInfo: TestHelper.getFileInfoMock({
                id: 'png_file_id',
                extension: 'png',
                width: 800,
                height: 600,
            }),
        };

        render(<ImagePreview {...props}/>);

        expect(screen.getByTestId('imagePreview').style.width).toBe('');
    });

    test('should apply both transform and SVG sizing together', () => {
        const props = {
            ...baseProps,
            fileInfo: svgFileInfo(800, 600),
            scale: 2,
        };

        render(<ImagePreview {...props}/>);

        expect(screen.getByTestId('imagePreview')).toHaveStyle({
            transform: 'scale(2)',
            width: '800px',
            height: 'auto',
        });
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
