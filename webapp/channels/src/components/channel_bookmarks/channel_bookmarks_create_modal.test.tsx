// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import ChannelBookmarkCreateModal from './channel_bookmarks_create_modal';

describe('components/channel_bookmarks/ChannelBookmarkCreateModal', () => {
    const baseProps = {
        channelId: 'channel_id',
        bookmarkType: 'file' as const,
        onExited: jest.fn(),
        onHide: jest.fn(),
        onConfirm: jest.fn(),
    };

    function makeState(enableFileAttachments: boolean, files: Record<string, ReturnType<typeof TestHelper.getFileInfoMock>> = {}) {
        return {
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: String(enableFileAttachments),
                        MaxFileSize: String(100 * 1048576),
                    },
                },
                files: {
                    files,
                },
            },
        };
    }

    test('should not open the file picker when uploads are disabled', () => {
        renderWithContext(
            <ChannelBookmarkCreateModal {...baseProps}/>,
            makeState(false),
        );

        const fileInput = document.getElementById('bookmark-create-file-input-in-modal');
        expect(fileInput).toBeInTheDocument();
        expect(fileInput).toBeDisabled();
        const click = jest.spyOn(fileInput as HTMLInputElement, 'click');

        const attachmentButton = screen.getByRole('button', {name: 'Edit'});

        // This is a div, so the greyed out styling has to come from a class rather than `disabled`
        expect(attachmentButton).not.toHaveAttribute('disabled');
        expect(window.getComputedStyle(attachmentButton).opacity).toBe('0.7');

        // Keep pointer events so an existing-file download link inside this container stays clickable
        expect(window.getComputedStyle(attachmentButton).pointerEvents).not.toBe('none');

        fireEvent.click(attachmentButton);

        expect(click).not.toHaveBeenCalled();
    });

    test('should open the file picker when uploads are enabled', () => {
        renderWithContext(
            <ChannelBookmarkCreateModal {...baseProps}/>,
            makeState(true),
        );

        const fileInput = document.getElementById('bookmark-create-file-input-in-modal');
        expect(fileInput).toBeInTheDocument();
        expect(fileInput).not.toBeDisabled();
        const click = jest.spyOn(fileInput as HTMLInputElement, 'click');

        const attachmentButton = screen.getByRole('button', {name: 'Edit'});
        expect(window.getComputedStyle(attachmentButton).pointerEvents).not.toBe('none');

        fireEvent.click(attachmentButton);

        expect(click).toHaveBeenCalled();
    });

    test('should keep an existing-file download link clickable when uploads are disabled', () => {
        const fileInfo = TestHelper.getFileInfoMock({
            id: 'file_info_id',
            name: 'doc.pdf',
            extension: 'pdf',
            has_preview_image: false,
        });
        const bookmark: ChannelBookmark = {
            id: 'bookmark_id',
            create_at: 1,
            update_at: 1,
            delete_at: 0,
            channel_id: 'channel_id',
            owner_id: 'user_id',
            file_id: fileInfo.id,
            display_name: 'Doc',
            sort_order: 0,
            type: 'file',
        };

        renderWithContext(
            <ChannelBookmarkCreateModal
                {...baseProps}
                bookmark={bookmark}
            />,
            makeState(false, {[fileInfo.id]: fileInfo}),
        );

        const fileInput = document.getElementById('bookmark-create-file-input-in-modal');
        expect(fileInput).toBeInTheDocument();
        expect(fileInput).toBeDisabled();
        const click = jest.spyOn(fileInput as HTMLInputElement, 'click');

        const downloadLink = screen.getByRole('link', {name: 'download'});
        expect(downloadLink).toBeInTheDocument();
        expect(downloadLink.closest('.post-image__download')).toBeInTheDocument();
        expect(window.getComputedStyle(downloadLink).pointerEvents).not.toBe('none');

        const attachmentButton = downloadLink.closest('[role="button"]');
        expect(attachmentButton).toBeInTheDocument();
        expect(attachmentButton).not.toHaveAttribute('disabled');
        expect(window.getComputedStyle(attachmentButton as HTMLElement).opacity).toBe('0.7');
        expect(window.getComputedStyle(attachmentButton as HTMLElement).pointerEvents).not.toBe('none');

        fireEvent.click(downloadLink);

        expect(click).not.toHaveBeenCalled();
    });
});
