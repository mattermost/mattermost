// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import FilePreview from './file_preview';

describe('FilePreview', () => {
    const onRemove = vi.fn();
    const fileInfos = [
        {
            width: 100,
            height: 100,
            name: 'test_filename',
            id: 'file_id_1',
            type: 'image/png',
            extension: 'png',
            has_preview_image: true,
            user_id: '',
            channel_id: 'channel_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            size: 100,
            mime_type: '',
            clientId: '',
            archived: false,
        },
    ];
    const uploadsInProgress = ['clientID_1'];
    const uploadsProgressPercent = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        clientID_1: {
            width: 100,
            height: 100,
            name: 'file',
            percent: 50,
            extension: 'image/png',
            id: 'file_id_1',
            has_preview_image: true,
            user_id: '',
            channel_id: 'channel_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            size: 100,
            mime_type: '',
            clientId: '',
            archived: false,
        },
    };

    const baseProps = {
        enableSVGs: false,
        fileInfos,
        uploadsInProgress,
        onRemove,
        uploadsProgressPercent,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(
            <FilePreview {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when props are changed', () => {
        const {container, rerender} = renderWithContext(
            <FilePreview {...baseProps}/>,
        );
        expect(container).toMatchSnapshot();

        const fileInfo2 = {
            id: 'file_id_2',
            create_at: 2,
            width: 100,
            height: 100,
            extension: 'jpg',
            name: '',
            user_id: '',
            channel_id: '',
            update_at: 0,
            delete_at: 0,
            size: 100,
            mime_type: '',
            clientId: '',
            archived: false,
            has_preview_image: true,
        };
        const newFileInfos = [...fileInfos, fileInfo2];

        rerender(
            <FilePreview
                {...baseProps}
                fileInfos={newFileInfos}
                uploadsInProgress={[]}
            />,
        );
        expect(container).toMatchSnapshot();
    });

    test('should call handleRemove when file removed', () => {
        const newOnRemove = vi.fn();
        const props = {...baseProps, onRemove: newOnRemove};

        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        // Find and click remove button
        const removeButton = container.querySelector('.file-preview__remove');
        if (removeButton) {
            removeButton.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        }

        expect(newOnRemove).toHaveBeenCalled();
    });

    test('should not render an SVG when SVGs are disabled', () => {
        const props = {
            ...baseProps,
            fileInfos: [
                {
                    ...baseProps.fileInfos[0],
                    type: 'image/svg',
                    extension: 'svg',
                },
            ],
        };

        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should render an SVG when SVGs are enabled', () => {
        const props = {
            ...baseProps,
            enableSVGs: true,
            fileInfos: [
                {
                    ...baseProps.fileInfos[0],
                    type: 'image/svg',
                    extension: 'svg',
                },
            ],
        };

        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });
});
