// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import type {FileInfo} from '@mattermost/types/files';

import {renderWithContext} from 'tests/react_testing_utils';

import MediaGallery from './media_gallery';

function fileInfo(overrides: Partial<FileInfo>): FileInfo {
    return {
        id: 'file1',
        user_id: 'u1',
        channel_id: 'c1',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        name: 'image.png',
        extension: 'png',
        size: 1024,
        mime_type: 'image/png',
        width: 800,
        height: 600,
        has_preview_image: true,
        clientId: '',
        archived: false,
        ...overrides,
    };
}

describe('MediaGallery', () => {
    const baseState = {
        entities: {
            general: {
                config: {EnablePublicLink: 'true'},
            },
        },
    };

    it('renders nothing when there are no image or video files', () => {
        const onClick = jest.fn();
        const {container} = renderWithContext(
            <MediaGallery
                fileInfos={[fileInfo({extension: 'pdf', mime_type: 'application/pdf'})]}
                postId='p1'
                onItemClick={onClick}
            />,
            baseState,
        );
        expect(container.firstChild).toBeNull();
    });

    it('renders an image tile and forwards the original fileInfos index on click', async () => {
        const onClick = jest.fn();
        const files = [
            fileInfo({id: 'a', extension: 'pdf', mime_type: 'application/pdf'}),
            fileInfo({id: 'b', name: 'pic.png'}),
        ];

        renderWithContext(
            <MediaGallery
                fileInfos={files}
                postId='p1'
                onItemClick={onClick}
            />,
            baseState,
        );

        const tile = await screen.findByTestId('media-gallery-tile');
        await userEvent.click(tile);

        // The PDF was skipped by the gallery but the modal should still open
        // at the image's index in the original fileInfos array (1, not 0).
        expect(onClick).toHaveBeenCalledWith(1);
    });

    it('renders a video tile for mp4 files', () => {
        const onClick = jest.fn();
        renderWithContext(
            <MediaGallery
                fileInfos={[fileInfo({id: 'v', name: 'clip.mp4', extension: 'mp4', mime_type: 'video/mp4'})]}
                postId='p1'
                onItemClick={onClick}
            />,
            baseState,
        );
        expect(screen.getByTestId('media-gallery-tile')).toBeInTheDocument();
    });
});
