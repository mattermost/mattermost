// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import AttachmentIcon from 'components/widgets/icons/attachment_icon';

import {renderWithContext, fireEvent} from 'tests/vitest_react_testing_utils';

import FilenameOverlay from './filename_overlay';

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

    test('should match snapshot, compact display', () => {
        const handleImageClick = vi.fn();
        const props = {...baseProps, compactDisplay: true, handleImageClick};
        const {container} = renderWithContext(
            <FilenameOverlay {...props}/>,
        );

        expect(container).toMatchSnapshot();

        // Find the link and click it
        const link = container.querySelector('a');
        if (link) {
            fireEvent.click(link);
        }
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
    });

    test('should match snapshot, standard but not downloadable', () => {
        const props = {...baseProps, canDownload: false};
        const {container} = renderWithContext(
            <FilenameOverlay {...props}>
                <AttachmentIcon/>
            </FilenameOverlay>,
        );

        expect(container).toMatchSnapshot();
    });
});
