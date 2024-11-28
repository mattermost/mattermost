// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, render} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import FilenameOverlay from 'components/file_attachment/filename_overlay';
import AttachmentIcon from 'components/widgets/icons/attachment_icon';

describe('components/file_attachment/FilenameOverlay', () => {
    const fileInfo = {
        id: 'thumbnail_id',
        name: 'test_filename',
        extension: 'jpg',
        width: 100,
        height: 80,
        has_preview_image: true,
        user_id: '',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        size: 100,
        mime_type: '',
        clientId: '',
        archived: false,
    };

    const baseProps = {
        fileInfo,
        handleImageClick: jest.fn(),
        compactDisplay: false,
        canDownload: true,
    };

    test('should render filename in standard display mode', () => {
        render(<FilenameOverlay {...baseProps}/>);

        const downloadLink = screen.getByRole('link', {name: /download/i});
        expect(downloadLink).toBeInTheDocument();
        expect(downloadLink).toHaveAttribute('href', `/api/v4/files/${fileInfo.id}?download=1`);
        expect(downloadLink).toHaveTextContent('test_filename');
    });

    test('should handle click in compact display mode', async () => {
        const handleImageClick = jest.fn();
        const props = {...baseProps, compactDisplay: true, handleImageClick};
        
        render(<FilenameOverlay {...props}/>);

        const link = screen.getByRole('link', {name: /test_filename/i});
        expect(link).toBeInTheDocument();
        
        const attachmentIcon = screen.getByTestId('AttachmentIcon');
        expect(attachmentIcon).toBeInTheDocument();

        await userEvent.click(link);
        expect(handleImageClick).toHaveBeenCalledTimes(1);
    });

    test('should render with Download icon as children', () => {
        const props = {...baseProps, canDownload: true};
        
        render(
            <FilenameOverlay {...props}>
                <AttachmentIcon/>
            </FilenameOverlay>,
        );

        const downloadLink = screen.getByRole('link', {name: /download/i});
        expect(downloadLink).toBeInTheDocument();
        
        const attachmentIcon = screen.getByTestId('AttachmentIcon');
        expect(attachmentIcon).toBeInTheDocument();
    });

    test('should render as text when not downloadable', () => {
        const props = {...baseProps, canDownload: false};
        
        render(
            <FilenameOverlay {...props}>
                <AttachmentIcon/>
            </FilenameOverlay>,
        );

        const filename = screen.getByText('test_filename');
        expect(filename).toBeInTheDocument();
        expect(filename).toHaveClass('post-image__name');
    });
});
