// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {getFileUrl} from 'mattermost-redux/utils/file_utils';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import FilePreview from './file_preview';

describe('FilePreview', () => {
    const onRemove = jest.fn();
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
            ...baseProps.fileInfos[0],
            id: 'file_id_2',
            create_at: 2,
            extension: 'jpg',
            name: 'file_two.jpg',
            size: 120,
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

    test('should call handleRemove when file removed', async () => {
        const newOnRemove = jest.fn();
        const props = {...baseProps, onRemove: newOnRemove};
        const {container} = renderWithContext(
            <FilePreview {...props}/>,
        );

        const user = userEvent.setup();
        const removeLink = container.querySelector('a.file-preview__remove');
        if (!removeLink) {
            throw new Error('Remove link not found');
        }
        await user.click(removeLink);
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

        expect(screen.queryByAltText('file preview')).not.toBeInTheDocument();
        expect(container.querySelector('.file-icon.generic')).toBeInTheDocument();
    });

    test('should render an SVG when SVGs are enabled', () => {
        const fileId = 'file_id_1';
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

        renderWithContext(
            <FilePreview {...props}/>,
        );

        expect(screen.getByAltText('file preview')).toHaveAttribute('src', getFileUrl(fileId));
    });
});
