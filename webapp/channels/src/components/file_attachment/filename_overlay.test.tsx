// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FilenameOverlay from 'components/file_attachment/filename_overlay';
import AttachmentIcon from 'components/widgets/icons/attachment_icon';

import {render, renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

describe('components/file_attachment/FilenameOverlay', () => {
    function emptyFunction() {} //eslint-disable-line no-empty-function
    const fileInfo = {
        id: 'thumbnail_id',
        name: 'test_filename',
        extension: 'jpg',
        width: 100,
        height: 80,
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
    };

    const baseProps = {
        fileInfo,
        handleImageClick: emptyFunction,
        compactDisplay: false,
        canDownload: true,
    };

    test('should match snapshot, standard display', () => {
        const {container} = renderWithContext(
            <FilenameOverlay {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, compact display', async () => {
        const handleImageClick = jest.fn();
        const props = {...baseProps, compactDisplay: true, handleImageClick};
        const {container} = renderWithContext(
            <FilenameOverlay {...props}/>,
        );

        expect(container).toMatchSnapshot();
        expect(container.querySelector('.icon')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('link'));
        expect(handleImageClick).toHaveBeenCalledTimes(1);
    });

    test('should match snapshot, with Download icon as children', () => {
        const props = {...baseProps, canDownload: true};
        const {container} = renderWithContext(
            <FilenameOverlay {...props}>
                <AttachmentIcon/>
            </FilenameOverlay>,
        );

        expect(container).toMatchSnapshot();
        expect(screen.getByRole('img', {name: 'Attachment Icon'})).toBeInTheDocument();
    });

    test('should match snapshot, standard but not downloadable', () => {
        const props = {...baseProps, canDownload: false};
        const {container} = render(
            <FilenameOverlay {...props}>
                <AttachmentIcon/>
            </FilenameOverlay>,
        );

        expect(container).toMatchSnapshot();
    });
});
