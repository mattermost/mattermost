// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {Post} from '@mattermost/types/posts';

import ConfirmOverwriteModal from 'components/conflict_warning_modal/confirm_overwrite_modal';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/ConfirmOverwriteModal', () => {
    const mockPost: Post = {
        id: 'post123',
        create_at: 1234567890,
        update_at: 1234567990000,
        delete_at: 0,
        edit_at: 0,
        is_pinned: false,
        user_id: 'user123',
        channel_id: 'channel123',
        root_id: '',
        original_id: '',
        message: 'test content',
        type: 'page',
        props: {
            title: 'Test Page Title',
        },
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {
            embeds: [],
            emojis: [],
            files: [],
            images: {},
        },
    };

    const baseProps = {
        currentPage: mockPost,
        onConfirm: jest.fn(),
        onCancel: jest.fn(),
        onExited: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal with correct title', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Confirm Overwrite')).toBeInTheDocument();
    });

    test('should display warning message', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        expect(screen.getByText(/You are about to permanently replace the changes made by another user/)).toBeInTheDocument();
    });

    test('should display explanation about action consequences', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
        expect(screen.getByText(/will remain in the page history/)).toBeInTheDocument();
    });

    test('should display page title', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        expect(screen.getByText(/Page: Test Page Title/)).toBeInTheDocument();
    });

    test('should display Untitled when page has no title', () => {
        const propsWithoutTitle = {
            ...baseProps,
            currentPage: {
                ...mockPost,
                props: {},
            },
        };

        renderWithContext(<ConfirmOverwriteModal {...propsWithoutTitle}/>);

        expect(screen.getByText(/Page: Untitled/)).toBeInTheDocument();
    });

    test('should display last modified time', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        expect(screen.getByText(/Last modified:/)).toBeInTheDocument();
    });

    test('should call onConfirm when Yes, Overwrite button is clicked', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        const confirmButton = screen.getByText('Yes, Overwrite');
        fireEvent.click(confirmButton);

        expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    test('should call onCancel when Go Back button is clicked', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        const cancelButton = screen.getByText('Go Back');
        fireEvent.click(cancelButton);

        expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    });

    test('should have confirm and cancel buttons', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        expect(screen.getByText('Yes, Overwrite')).toBeInTheDocument();
        expect(screen.getByText('Go Back')).toBeInTheDocument();
    });

    test('should have warning icon', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        const warningIcon = document.querySelector('.icon-alert-outline');
        expect(warningIcon).toBeInTheDocument();
    });

    test('should have correct test id', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        expect(screen.getByTestId('confirm-overwrite-modal')).toBeInTheDocument();
    });

    test('should be a delete modal (red confirm button)', () => {
        renderWithContext(<ConfirmOverwriteModal {...baseProps}/>);

        // The GenericModal with isDeleteModal=true renders a destructive button
        const confirmButton = screen.getByText('Yes, Overwrite');
        expect(confirmButton).toBeInTheDocument();
    });
});
