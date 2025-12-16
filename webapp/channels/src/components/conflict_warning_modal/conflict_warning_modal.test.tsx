// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {Post} from '@mattermost/types/posts';

import ConflictWarningModal from 'components/conflict_warning_modal/conflict_warning_modal';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/ConflictWarningModal', () => {
    const mockPost: Post = {
        id: 'post123',
        create_at: 1234567890,
        update_at: 1234567990,
        delete_at: 0,
        edit_at: 0,
        is_pinned: false,
        user_id: 'user123',
        channel_id: 'channel123',
        root_id: '',
        original_id: '',
        message: 'test content',
        type: '',
        props: {
            title: 'Test Page',
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
        onViewChanges: jest.fn(),
        onCopyContent: jest.fn(),
        onOverwrite: jest.fn(),
        onCancel: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal when show is true', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Page Was Modified')).toBeInTheDocument();
        expect(screen.getByText(/Someone else published this page first/)).toBeInTheDocument();
    });

    test('should display current page title and last modified time', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>);

        expect(screen.getByText(/Page: Test Page/)).toBeInTheDocument();
        expect(screen.getByText(/Last modified:/)).toBeInTheDocument();
    });

    test('should call onViewChanges when View Their Changes button is clicked', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>);

        const viewChangesButton = screen.getByText('View Their Changes');
        fireEvent.click(viewChangesButton);

        expect(baseProps.onViewChanges).toHaveBeenCalledTimes(1);
    });

    test('should call onCopyContent when Copy My Content button is clicked', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>);

        const copyContentButton = screen.getByText('Copy My Content');
        fireEvent.click(copyContentButton);

        expect(baseProps.onCopyContent).toHaveBeenCalledTimes(1);
    });

    test('should call onOverwrite when Overwrite Anyway button is clicked', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>);

        const overwriteButton = screen.getByText('Overwrite Anyway');
        fireEvent.click(overwriteButton);

        expect(baseProps.onOverwrite).toHaveBeenCalledTimes(1);
    });

    test('should call onCancel when Cancel button is clicked', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>);

        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);

        expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    });

    test('should render close button in header', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>);

        const closeButton = screen.getByRole('button', {name: /close/i});
        expect(closeButton).toBeInTheDocument();
    });

    test('should show Untitled when page has no title', () => {
        const propsWithoutTitle = {
            ...baseProps,
            currentPage: {
                ...mockPost,
                props: {},
            },
        };

        renderWithContext(<ConflictWarningModal {...propsWithoutTitle}/>);

        expect(screen.getByText(/Page: Untitled/)).toBeInTheDocument();
    });

    test('should display all action buttons', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>);

        expect(screen.getByText('View Their Changes')).toBeInTheDocument();
        expect(screen.getByText('Copy My Content')).toBeInTheDocument();
        expect(screen.getByText('Overwrite Anyway')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
});
