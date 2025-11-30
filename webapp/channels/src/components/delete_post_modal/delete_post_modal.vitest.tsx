// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostType, PostMetadata} from '@mattermost/types/posts';

import DeletePostModal from 'components/delete_post_modal/delete_post_modal';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
import {getHistory} from 'utils/browser_history';

describe('components/delete_post_modal', () => {
    const post = {
        id: '123',
        message: 'test',
        channel_id: '5',
        type: '' as PostType,
        root_id: '',
        create_at: 0,
        update_at: 0,
        edit_at: 0,
        delete_at: 0,
        is_pinned: false,
        user_id: '',
        original_id: '',
        props: {} as Record<string, any>,
        hashtags: '',
        pending_post_id: '',
        reply_count: 0,
        metadata: {} as PostMetadata,
        remote_id: '',
    };

    const baseProps = {
        post,
        commentCount: 0,
        isRHS: false,
        actions: {
            deleteAndRemovePost: vi.fn(),
        },
        onExited: vi.fn(),
        channelName: 'channel_name',
        teamName: 'team_name',
        location: {
            pathname: '',
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot for delete_post_modal with 0 comments', () => {
        const {baseElement} = renderWithContext(
            <DeletePostModal {...baseProps}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot for delete_post_modal with 1 comment', () => {
        const commentCount = 1;
        const props = {...baseProps, commentCount};
        const {baseElement} = renderWithContext(
            <DeletePostModal {...props}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should match snapshot for post with 1 commentCount and is not rootPost', () => {
        const commentCount = 1;
        const postObj = {
            ...post,
            root_id: '1234',
        };

        const props = {
            ...baseProps,
            commentCount,
            post: postObj,
        };

        const {baseElement} = renderWithContext(
            <DeletePostModal {...props}/>,
        );
        expect(baseElement).toMatchSnapshot();
    });

    test('should focus delete button on enter', async () => {
        renderWithContext(
            <DeletePostModal {...baseProps}/>,
        );

        // Wait for the modal to be shown and the delete button to be focused
        await waitFor(() => {
            const deleteButton = screen.getByRole('button', {name: /delete/i});
            expect(deleteButton).toHaveFocus();
        });
    });

    test('should match state when onHide is called', async () => {
        renderWithContext(
            <DeletePostModal {...baseProps}/>,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Click the cancel button to trigger onHide
        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        fireEvent.click(cancelButton);

        // Verify modal is hidden after onHide is called
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should match state when the cancel button is clicked', async () => {
        renderWithContext(
            <DeletePostModal {...baseProps}/>,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Click the cancel button
        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        fireEvent.click(cancelButton);

        // Verify modal is hidden after cancel button is clicked
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should have called actions.deleteAndRemovePost when handleDelete is called', async () => {
        const deleteAndRemovePost = vi.fn().mockReturnValueOnce({data: true});
        const props = {
            ...baseProps,
            actions: {
                deleteAndRemovePost,
            },
            location: {
                pathname: '/teamname/messages/@username',
            },
        };
        renderWithContext(
            <DeletePostModal {...props}/>,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Find and click the delete button
        const deleteButton = screen.getByRole('button', {name: /delete/i});
        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(deleteAndRemovePost).toHaveBeenCalledTimes(1);
        });
        expect(deleteAndRemovePost).toHaveBeenCalledWith(props.post);
    });

    test('should have called browserHistory.replace when permalink post is deleted for DM/GM', async () => {
        const deleteAndRemovePost = vi.fn().mockReturnValueOnce({data: true});
        const props = {
            ...baseProps,
            actions: {
                deleteAndRemovePost,
            },
            location: {
                pathname: '/teamname/messages/@username/123',
            },
        };

        renderWithContext(
            <DeletePostModal {...props}/>,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Find and click the delete button
        const deleteButton = screen.getByRole('button', {name: /delete/i});
        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(deleteAndRemovePost).toHaveBeenCalledTimes(1);
        });
        expect(getHistory().replace).toHaveBeenCalledWith('/teamname/messages/@username');
    });

    test('should have called browserHistory.replace when permalink post is deleted for a channel', async () => {
        const deleteAndRemovePost = vi.fn().mockReturnValueOnce({data: true});
        const props = {
            ...baseProps,
            actions: {
                deleteAndRemovePost,
            },
            location: {
                pathname: '/teamname/channels/channelName/123',
            },
        };

        renderWithContext(
            <DeletePostModal {...props}/>,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Find and click the delete button
        const deleteButton = screen.getByRole('button', {name: /delete/i});
        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(deleteAndRemovePost).toHaveBeenCalledTimes(1);
        });
        expect(getHistory().replace).toHaveBeenCalledWith('/teamname/channels/channelName');
    });

    test('should have called props.onExiteed when Modal.onExited is called', async () => {
        const onExited = vi.fn();
        const props = {
            ...baseProps,
            onExited,
        };

        renderWithContext(
            <DeletePostModal {...props}/>,
        );

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Click cancel to close the modal
        const cancelButton = screen.getByRole('button', {name: /cancel/i});
        fireEvent.click(cancelButton);

        // Wait for the modal to fully close and onExited to be called
        await waitFor(() => {
            expect(onExited).toHaveBeenCalled();
        }, {timeout: 5000});
    });

    test('should warn about remote post deletion', () => {
        const props = {
            ...baseProps,
            post: {
                ...post,
                remote_id: 'remoteclusterid1',
            },
        };

        const {baseElement} = renderWithContext(
            <DeletePostModal {...props}/>,
        );

        // Verify the component renders with remote post
        expect(baseElement).toMatchSnapshot();
    });
});
