// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent, waitFor} from '@testing-library/react';
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
        message: 'Published paragraph A\n\nPublished paragraph B',
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
        draftContent: 'Draft paragraph A\n\nDraft paragraph B',
        onContinueEditing: jest.fn(),
        onOverwrite: jest.fn(),
        onDiscard: jest.fn(() => Promise.resolve()),
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

    // The confirm button label is dynamic (Compare versions / Continue editing / Overwrite now)
    // and can collide with option-button labels, so we locate it by the GenericModal class.
    const clickConfirm = () => {
        // GenericModal renders the primary action with class `confirm`, or `delete` when
        // confirmButtonVariant='destructive' (e.g. when Overwrite is selected).
        const btn = document.querySelector('button.GenericModal__button.confirm, button.GenericModal__button.delete') as HTMLButtonElement | null;
        if (!btn) {
            throw new Error('Confirm button not found');
        }
        fireEvent.click(btn);
    };

    test('renders modal with title and the three option-select choices using new label "Compare versions"', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);
        expect(screen.getByText('Page conflict')).toBeInTheDocument();

        // "Compare versions" appears as both an option title and the confirm button label
        // when the default ('review') option is selected.
        expect(screen.getAllByText('Compare versions').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Continue editing my draft')).toBeInTheDocument();
        expect(screen.getByText('Overwrite published version')).toBeInTheDocument();
    });

    test('Confirm on Compare versions transitions to diff-view with both pane regions and three action buttons', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);

        clickConfirm();

        expect(screen.getByTestId('conflict-diff-panel')).toBeInTheDocument();
        expect(screen.getByRole('region', {name: 'Your draft'})).toBeInTheDocument();
        expect(screen.getByRole('region', {name: 'Published version'})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Back to my draft/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Keep published version/i})).toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Overwrite published version/i})).toBeInTheDocument();
        expect(screen.getByText(/Your version replaces the published page/i)).toBeInTheDocument();
        expect(screen.getByText(/The published version is kept; your draft is deleted/i)).toBeInTheDocument();
    });

    test('null draftContent renders "Unable to preview draft content." in left pane', () => {
        renderWithContext(<ConflictWarningModal {...{...baseProps, draftContent: null}}/>, initialState);
        clickConfirm();
        expect(screen.getByText('Unable to preview draft content.')).toBeInTheDocument();
    });

    test('empty-string draftContent renders "Your draft has no content."', () => {
        renderWithContext(<ConflictWarningModal {...{...baseProps, draftContent: ''}}/>, initialState);
        clickConfirm();
        expect(screen.getByText('Your draft has no content.')).toBeInTheDocument();
    });

    test('identical draft and published shows inline notice without entering diff-view', () => {
        const identical = {
            ...baseProps,
            draftContent: mockPost.message,
        };
        renderWithContext(<ConflictWarningModal {...identical}/>, initialState);
        clickConfirm();
        expect(screen.getByText('Your draft matches the published version.')).toBeInTheDocument();
        expect(screen.queryByTestId('conflict-diff-panel')).not.toBeInTheDocument();
    });

    test('Keep published version calls onDiscard and shows discarding spinner', async () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);
        clickConfirm();

        fireEvent.click(screen.getByRole('button', {name: /Keep published version/i}));

        await waitFor(() => {
            expect(baseProps.onDiscard).toHaveBeenCalledTimes(1);
        });
    });

    test('Keep published version rejection shows inline error and resets state', async () => {
        const props = {
            ...baseProps,
            onDiscard: jest.fn(() => Promise.reject(new Error('boom'))),
        };
        renderWithContext(<ConflictWarningModal {...props}/>, initialState);
        clickConfirm();
        fireEvent.click(screen.getByRole('button', {name: /Keep published version/i}));

        await waitFor(() => {
            expect(screen.getByText('Failed to discard draft. Try again.')).toBeInTheDocument();
        });
        expect(screen.getByRole('button', {name: /Back to my draft/i})).not.toBeDisabled();
    });

    test('Continue editing my draft path calls onContinueEditing', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);
        fireEvent.click(screen.getByText('Continue editing my draft'));
        clickConfirm();
        expect(baseProps.onContinueEditing).toHaveBeenCalledTimes(1);
    });

    test('Overwrite published version path on option-select calls onOverwrite', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);
        fireEvent.click(screen.getAllByText('Overwrite published version')[0]);
        clickConfirm();
        expect(baseProps.onOverwrite).toHaveBeenCalledTimes(1);
    });

    test('Back to my draft from diff-view calls onContinueEditing', () => {
        renderWithContext(<ConflictWarningModal {...baseProps}/>, initialState);
        clickConfirm();
        fireEvent.click(screen.getByRole('button', {name: /Back to my draft/i}));
        expect(baseProps.onContinueEditing).toHaveBeenCalledTimes(1);
    });

    test('shows Untitled when page has no title', () => {
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
