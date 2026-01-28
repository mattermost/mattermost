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
        onContinueEditing: jest.fn(),
        onOverwrite: jest.fn(),
    };

    const initialState = {
        entities: {
            users: {
                profiles: {
                    user123: {
                        id: 'user123',
                        username: 'testuser',
                    },
                },
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render modal with correct title', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Page conflict')).toBeInTheDocument();
        expect(screen.getByText(/Your changes are saved, but another team member updated this page/)).toBeInTheDocument();
    });

    test('should display current page title and modified by info', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        expect(screen.getByText('Test Page')).toBeInTheDocument();
        expect(screen.getByText(/Page:/)).toBeInTheDocument();
        expect(screen.getByText(/Modified:/)).toBeInTheDocument();
    });

    test('should show three options', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        expect(screen.getByText('Review and merge changes')).toBeInTheDocument();
        expect(screen.getByText('Continue editing my draft')).toBeInTheDocument();
        expect(screen.getByText('Overwrite published version')).toBeInTheDocument();
    });

    test('should have Review changes option selected by default', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        expect(screen.getByText('Review changes')).toBeInTheDocument();
    });

    test('should call onViewChanges when Review changes is confirmed', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        const confirmButton = screen.getByText('Review changes');
        fireEvent.click(confirmButton);

        expect(baseProps.onViewChanges).toHaveBeenCalledTimes(1);
    });

    test('should change confirm button when Continue editing option is selected', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        const continueOption = screen.getByText('Continue editing my draft');
        fireEvent.click(continueOption);

        expect(screen.getByText('Continue editing')).toBeInTheDocument();
    });

    test('should call onContinueEditing when Continue editing is confirmed', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        const continueOption = screen.getByText('Continue editing my draft');
        fireEvent.click(continueOption);

        const confirmButton = screen.getByText('Continue editing');
        fireEvent.click(confirmButton);

        expect(baseProps.onContinueEditing).toHaveBeenCalledTimes(1);
    });

    test('should change confirm button to red when Overwrite option is selected', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        const overwriteOption = screen.getByText('Overwrite published version');
        fireEvent.click(overwriteOption);

        expect(screen.getByText('Overwrite page')).toBeInTheDocument();
    });

    test('should call onOverwrite when Overwrite page is confirmed', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        const overwriteOption = screen.getByText('Overwrite published version');
        fireEvent.click(overwriteOption);

        const confirmButton = screen.getByText('Overwrite page');
        fireEvent.click(confirmButton);

        expect(baseProps.onOverwrite).toHaveBeenCalledTimes(1);
    });

    test('should call onContinueEditing when Back to editing button is clicked', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        const cancelButton = screen.getByText('Back to editing');
        fireEvent.click(cancelButton);

        expect(baseProps.onContinueEditing).toHaveBeenCalledTimes(1);
    });

    test('should render close button in header', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

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

        renderWithContext(<ConflictWarningModal {...propsWithoutTitle}/>, initialState);

        expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
});
