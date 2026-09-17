// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {fireEvent, renderWithContext, screen} from 'tests/react_testing_utils';

import ChannelBookmarkCreateModal from './channel_bookmarks_create_modal';

describe('components/channel_bookmarks/ChannelBookmarkCreateModal', () => {
    const baseProps = {
        channelId: 'channel_id',
        bookmarkType: 'file' as const,
        onExited: jest.fn(),
        onHide: jest.fn(),
        onConfirm: jest.fn(),
    };

    function makeState(enableFileAttachments: boolean) {
        return {
            entities: {
                general: {
                    config: {
                        EnableFileAttachments: String(enableFileAttachments),
                        MaxFileSize: String(100 * 1048576),
                    },
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
        const click = jest.spyOn(fileInput as HTMLInputElement, 'click');

        const attachmentButton = screen.getByRole('button', {name: 'Edit'});

        // This is a div, so the greyed out styling has to come from a class rather than `disabled`
        expect(attachmentButton).not.toHaveAttribute('disabled');
        expect(window.getComputedStyle(attachmentButton).opacity).toBe('0.7');
        expect(window.getComputedStyle(attachmentButton).pointerEvents).toBe('none');

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
        const click = jest.spyOn(fileInput as HTMLInputElement, 'click');

        const attachmentButton = screen.getByRole('button', {name: 'Edit'});
        expect(window.getComputedStyle(attachmentButton).pointerEvents).not.toBe('none');

        fireEvent.click(attachmentButton);

        expect(click).toHaveBeenCalled();
    });
});
